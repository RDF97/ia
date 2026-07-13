import * as cheerio from "cheerio";

export type LabeledFields = Map<string, string>;

/**
 * Extrae pares etiqueta→valor de las tablas del email (primera celda = etiqueta,
 * resto = valor). Las claves se normalizan a minúsculas sin puntuación final.
 */
export function extractLabeledFields(html: string): LabeledFields {
  const $ = cheerio.load(html);
  const fields: LabeledFields = new Map();
  $("tr").each((_, tr) => {
    const cells = $(tr).children("td, th");
    if (cells.length < 2) return;
    const label = normalize($(cells[0]).text()).replace(/[.:]+$/, "").toLowerCase();
    const value = cells
      .slice(1)
      .map((_, c) => cellText($, c))
      .get()
      .join(" ")
      .trim();
    if (label && !fields.has(label)) fields.set(label, value);
  });
  return fields;
}

/** Texto de una celda preservando saltos de línea de <br>. */
function cellText($: cheerio.CheerioAPI, cell: unknown): string {
  const cloned = $(cell as Parameters<typeof $>[0]).clone();
  cloned.find("br").replaceWith("\n");
  return cloned
    .text()
    .split("\n")
    .map((l) => normalize(l))
    .filter(Boolean)
    .join("\n");
}

export function normalize(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Todo el texto plano del email, con espacios normalizados. */
export function fullText(html: string): string {
  const $ = cheerio.load(html);
  return normalize($.root().text());
}

// Saludos y avisos genéricos que no son el nombre del producto.
const NON_PRODUCT_HEADING = /supply partner|great news|booking|cancelled|reserva/i;

/** El encabezado que parece el título del producto (no un saludo del email). */
export function productHeading(html: string, minLength = 15): string | undefined {
  const $ = cheerio.load(html);
  const headings: string[] = [];
  $("h1, h2, h3").each((_, el) => {
    const t = normalize($(el).text());
    if (t.length >= minLength) headings.push(t);
  });
  return headings.find((t) => !NON_PRODUCT_HEADING.test(t)) ?? headings[0];
}
