import { functions } from "./appwrite";
import { SCAN_FUNCTION_ID } from "./db";

export interface ReceiptLine {
  description: string;
  qty: number | null;
  total: number | null; // importe de la línea
}

export interface ReceiptData {
  merchant: string | null;
  date: string | null; // ISO (yyyy-mm-dd)
  total: number | null;
  currency: string | null;
  lines: ReceiptLine[];
}

function errorText(code?: string): string {
  switch (code) {
    case "no-image":
      return "No se recibió la foto del ticket.";
    case "no-key":
      return "Falta configurar la clave de OCR en el servidor.";
    case "ocr":
      return "El servicio de lectura no pudo leer la foto. Prueba con una más nítida y recta.";
    case "auth":
      return "Inicia sesión para escanear tickets.";
    default:
      return "No se pudo leer el ticket. Prueba con una foto más nítida y recta.";
  }
}

/** Envía la foto (base64) a la función; esta llama a OCR.space y devuelve el texto crudo. */
export async function scanReceipt(base64: string, mime = "image/jpeg"): Promise<ReceiptData> {
  const exec = await functions.createExecution({
    functionId: SCAN_FUNCTION_ID,
    body: JSON.stringify({ image: base64, mime }),
  });
  let out: { ok?: boolean; error?: string; text?: string } = {};
  try {
    out = JSON.parse(exec.responseBody || "{}");
  } catch {
    /* respuesta no-JSON */
  }
  if (!out.ok || typeof out.text !== "string") throw new Error(errorText(out.error));
  return parseReceipt(out.text);
}

// --- Parseo del texto del ticket (puro y testeable) ---

/** Importe estilo es/en → número. Solo positivos (importes de ticket). */
export function parseMoney(raw: string): number | null {
  let s = String(raw).replace(/[^0-9.,]/g, "");
  if (!s) return null;
  const hasDot = s.includes(".");
  const hasComma = s.includes(",");
  if (hasDot && hasComma) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (hasComma) {
    s = s.replace(",", ".");
  }
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
}

const MONEY_RE = /\d{1,4}(?:[.,]\d{3})*[.,]\d{2}/g;

function amountsIn(line: string): number[] {
  const found = line.match(MONEY_RE);
  if (!found) return [];
  return found.map(parseMoney).filter((n): n is number => n !== null);
}

function findDate(text: string): string | null {
  let m = text.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (m) {
    let y = parseInt(m[3], 10);
    if (y < 100) y += 2000;
    const mo = parseInt(m[2], 10);
    const d = parseInt(m[1], 10);
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }
  return null;
}

// Líneas que NO son productos (totales, impuestos, pagos…).
const SKIP_LINE = /total|sub\s*total|iva|i\.v\.a|base imponible|cambio|efectivo|tarjeta|entrega|devoluc|redondeo|a pagar|cuota|importe|s\.a\.|c\.i\.f|n\.i\.f/i;

/** Convierte el texto OCR en datos estructurados (best-effort). */
export function parseReceipt(text: string): ReceiptData {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Comercio: normalmente la primera línea con letras y sin importe (el nombre
  // de la tienda va arriba; "S.A."/"S.L." forman parte del nombre, no se filtran).
  const merchant =
    lines.find((l) => /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{3,}/.test(l) && amountsIn(l).length === 0) ?? null;

  const date = findDate(text);

  // Total: línea con "total" (no subtotal) → último importe; si no, el mayor del ticket.
  let total: number | null = null;
  for (const l of lines) {
    if (/total/i.test(l) && !/sub\s*total/i.test(l)) {
      const a = amountsIn(l);
      if (a.length) {
        total = a[a.length - 1];
        break;
      }
    }
  }
  if (total === null) {
    const all = lines.flatMap(amountsIn);
    total = all.length ? Math.max(...all) : null;
  }

  // Productos: "descripción … precio" al final de la línea, descartando totales/pagos.
  const items: ReceiptLine[] = [];
  for (const l of lines) {
    if (SKIP_LINE.test(l)) continue;
    const m = l.match(/^(.*[A-Za-zÁÉÍÓÚÜÑáéíóúüñ].*?)\s+(\d{1,4}(?:[.,]\d{3})*[.,]\d{2})\s*€?$/);
    if (m) {
      const description = m[1].trim();
      const price = parseMoney(m[2]);
      if (description.length >= 2 && price !== null) items.push({ description, qty: null, total: price });
    }
  }

  return { merchant, date, total, currency: null, lines: items };
}
