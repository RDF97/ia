// Parseo tolerante de CSV de banco: detecta separador, comillas, decimales con
// coma o punto y varios formatos de fecha. Todo puro y testeable.

// Un texto leído como UTF-8 con bytes inválidos contiene el carácter de
// reemplazo U+FFFD: señal de que el archivo venía en otra codificación (latin-1).
export function looksMojibake(text: string): boolean {
  return text.includes("�");
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Decodifica base64 interpretando cada byte como ISO-8859-1 (latin-1). */
export function latin1FromBase64(b64: string): string {
  const s = b64.replace(/[^A-Za-z0-9+/]/g, "");
  let out = "";
  for (let i = 0; i < s.length; i += 4) {
    const e1 = B64.indexOf(s[i]);
    const e2 = B64.indexOf(s[i + 1]);
    const e3 = B64.indexOf(s[i + 2]);
    const e4 = B64.indexOf(s[i + 3]);
    out += String.fromCharCode((e1 << 2) | (e2 >> 4));
    if (e3 !== -1) out += String.fromCharCode(((e2 & 15) << 4) | (e3 >> 2));
    if (e4 !== -1) out += String.fromCharCode(((e3 & 3) << 6) | e4);
  }
  return out;
}

export function detectDelimiter(line: string): string {
  const counts = [";", ",", "\t"].map((d) => [d, line.split(d).length - 1] as const);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ",";
}

/** Convierte el texto CSV en una matriz de celdas. Respeta comillas dobles. */
export function parseCsv(text: string, delimiter?: string): string[][] {
  const clean = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const firstLine = clean.split("\n").find((l) => l.trim().length > 0) ?? "";
  const delim = delimiter ?? detectDelimiter(firstLine);

  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delim) {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

/** Importe con separadores es/en. Cargos negativos, abonos positivos. */
export function parseAmount(raw: string): number | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;
  const negative = s.includes("-") || (s.includes("(") && s.includes(")"));
  s = s.replace(/[()]/g, "").replace(/[^0-9.,]/g, "");
  if (!s) return null;

  const hasDot = s.includes(".");
  const hasComma = s.includes(",");
  if (hasDot && hasComma) {
    // El separador decimal es el que aparece más a la derecha.
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (hasComma) {
    s = s.replace(/\./g, "").replace(",", ".");
  }
  const n = parseFloat(s);
  if (!isFinite(n)) return null;
  return negative ? -Math.abs(n) : n;
}

function isoLocal(y: number, mo: number, d: number): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return new Date(y, mo - 1, d, 12, 0, 0, 0).toISOString();
}

/** Fecha en dd/mm/aaaa, dd-mm-aaaa, dd.mm.aa o aaaa-mm-dd. Devuelve ISO (mediodía local). */
export function parseDate(raw: string): string | null {
  const s = String(raw ?? "").trim();
  let m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (m) {
    let y = parseInt(m[3], 10);
    if (y < 100) y += 2000;
    return isoLocal(y, parseInt(m[2], 10), parseInt(m[1], 10));
  }
  m = s.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
  if (m) return isoLocal(parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10));
  return null;
}

export interface CsvMapping {
  date: number;
  concept: number;
  amount: number;
}

export interface BankMovement {
  date: string; // ISO
  concept: string;
  amount: number; // negativo = cargo/gasto
}

/** Adivina qué columna es cada cosa a partir de los encabezados. */
export function guessMapping(header: string[]): Partial<CsvMapping> {
  const find = (keys: string[]) =>
    header.findIndex((h) => keys.some((k) => h.toLowerCase().includes(k)));
  const out: Partial<CsvMapping> = {};
  const date = find(["fecha", "date", "valor"]);
  const concept = find(["concepto", "descrip", "detalle", "movimiento", "concept", "description"]);
  const amount = find(["importe", "amount", "cantidad", "monto", "cargo"]);
  if (date >= 0) out.date = date;
  if (concept >= 0) out.concept = concept;
  if (amount >= 0) out.amount = amount;
  return out;
}

/** Convierte filas + mapeo en movimientos con fecha e importe válidos. */
export function parseBankRows(rows: string[][], mapping: CsvMapping, hasHeader: boolean): BankMovement[] {
  const body = hasHeader ? rows.slice(1) : rows;
  const out: BankMovement[] = [];
  for (const r of body) {
    const date = parseDate(r[mapping.date] ?? "");
    const amount = parseAmount(r[mapping.amount] ?? "");
    if (date === null || amount === null) continue;
    const concept = (r[mapping.concept] ?? "").trim() || "Movimiento";
    out.push({ date, concept, amount });
  }
  return out;
}
