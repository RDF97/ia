import { functions } from "./appwrite";
import { SCAN_FUNCTION_ID } from "./db";

export interface ReceiptLine {
  description: string;
  qty: number | null;
  unitPrice: number | null; // precio por unidad (para la base de precios)
  total: number | null; // importe de la línea (unit × qty)
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

/**
 * Envía la foto/PDF (base64) a la función; esta la INTERPRETA con Gemini (visión)
 * y devuelve los datos ya estructurados. Si por lo que sea llegara texto crudo,
 * cae en el parser local (parseReceipt) como red de seguridad.
 */
export async function scanReceipt(base64: string, mime = "image/jpeg"): Promise<ReceiptData> {
  const exec = await functions.createExecution({
    functionId: SCAN_FUNCTION_ID,
    body: JSON.stringify({ image: base64, mime }),
  });
  let out: { ok?: boolean; error?: string; data?: ReceiptData; text?: string } = {};
  try {
    out = JSON.parse(exec.responseBody || "{}");
  } catch {
    /* respuesta no-JSON */
  }
  if (out.ok && out.data) return out.data;
  if (out.ok && typeof out.text === "string") return parseReceipt(out.text);
  throw new Error(errorText(out.error));
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

const letterCount = (l: string): number => (l.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g) || []).length;
// "23:09" (barra de estado)
const isTimeLine = (l: string): boolean => /^\s*\d{1,2}:\d{2}\b/.test(l);
// "18 jul 2026", "18/07/2026" (cabeceras del visor de fotos, fechas)
const isDateLine = (l: string): boolean =>
  /^\s*\d{1,2}[\s/\-.]+(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic|\d{1,2})[\s/\-.]+\d{2,4}/i.test(l);

function findDate(text: string): string | null {
  const m = text.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
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

// Líneas que NO son productos (totales, impuestos, pagos, cabeceras fiscales…).
const SKIP_LINE =
  /\b(sub\s*total|iva|i\.v\.a|base imponible|cambio|efectivo|tarjeta|visa|debit|entrega|devoluc|redondeo|a pagar|cuota|pvp|suma|nif|cif|www|tel|gracias|recibo|cliente|venta|importe|unidad|art[ií]culos)\b/i;
// Filas de la tabla de IVA: "A 4% ...", "B 10% ..."
const isTaxCodeRow = (l: string): boolean => /^[A-Z]\s+\d{1,2}\s*%/.test(l.trim());

/** Convierte el texto OCR en datos estructurados (best-effort). */
export function parseReceipt(text: string): ReceiptData {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Comercio: primera línea "real" (con letras, que no sea hora/fecha ni importe).
  const merchant =
    lines.find((l) => letterCount(l) >= 4 && !isDateLine(l) && !isTimeLine(l) && amountsIn(l).length === 0) ?? null;

  const date = findDate(text);

  // Línea de TOTAL (no subtotal): marca dónde acaban los productos.
  const totalIdx = lines.findIndex((l) => /\btotal\b/i.test(l) && !/sub\s*total/i.test(l));

  // Total: importe de la línea TOTAL; si no, el mayor importe del ticket.
  let total: number | null = null;
  if (totalIdx >= 0) {
    const a = amountsIn(lines[totalIdx]);
    if (a.length) total = a[a.length - 1];
  }
  if (total === null) {
    const all = lines.flatMap(amountsIn);
    total = all.length ? Math.max(...all) : null;
  }

  // Productos: solo por encima de la línea TOTAL (así no cuelan totales, IVA ni pagos).
  const region = totalIdx >= 0 ? lines.slice(0, totalIdx) : lines;
  const items: ReceiptLine[] = [];
  for (const l of region) {
    if (SKIP_LINE.test(l) || isTaxCodeRow(l)) continue;
    // "descripción … precio [letra de IVA]" → p. ej. "LIMA PACK 4   1,19 A"
    const m = l.match(/^(.+?[A-Za-zÁÉÍÓÚÜÑáéíóúüñ].*?)\s+(\d{1,4}(?:[.,]\d{3})*[.,]\d{2})\s*[A-Z]?\.?\s*$/);
    if (!m) continue;
    // quita cantidades tipo "4,49x 2" al final de la descripción
    const description = m[1].replace(/\s*\d[\d.,]*\s*x\s*\d+\s*$/i, "").trim();
    const price = parseMoney(m[2]);
    if (description.length >= 2 && letterCount(description) >= 2 && price !== null) {
      items.push({ description, qty: null, unitPrice: null, total: price });
    }
  }

  return { merchant, date, total, currency: null, lines: items };
}
