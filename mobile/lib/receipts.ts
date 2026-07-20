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
    case "mindee":
      return "El servicio de lectura de tickets no respondió bien. Inténtalo con otra foto más nítida.";
    case "auth":
      return "Inicia sesión para escanear tickets.";
    default:
      return "No se pudo leer el ticket. Prueba con una foto más nítida y recta.";
  }
}

/** Envía la foto (base64) a la función del servidor, que llama a Mindee y devuelve los datos. */
export async function scanReceipt(base64: string, mime = "image/jpeg"): Promise<ReceiptData> {
  const exec = await functions.createExecution({
    functionId: SCAN_FUNCTION_ID,
    body: JSON.stringify({ image: base64, mime }),
  });
  let out: { ok?: boolean; error?: string; data?: ReceiptData } = {};
  try {
    out = JSON.parse(exec.responseBody || "{}");
  } catch {
    /* respuesta no-JSON */
  }
  if (!out.ok || !out.data) throw new Error(errorText(out.error));
  return out.data;
}
