import * as cheerio from "cheerio";

export type LabeledFields = Map<string, string>;

/**
 * Extrae pares etiqueta→valor de las tablas del email (primera celda = etiqueta,
 * resto = valor). Las claves se normalizan a minúsculas sin puntuación final.
 */
export function extractLabeledFields(html: string): LabeledFields {
  const $ = cheerio.load(html);
  const fields: LabeledFields = new Map();
  const add = (label: string, value: string) => {
    const key = normalize(label).replace(/[.:]+$/, "").toLowerCase();
    if (key && value.trim() && !fields.has(key)) fields.set(key, value.trim());
  };

  // 1) Tabla clásica: etiqueta en la primera celda, valor en las siguientes.
  $("tr").each((_, tr) => {
    const cells = $(tr).children("td, th");
    if (cells.length < 2) return;
    // Una fila de solo <th> es la CABECERA de una tabla de datos, no un par
    // etiqueta/valor: tomarla como par daba nombres falsos ("Name" → "Email").
    if (cells.toArray().every((c) => "tagName" in c && c.tagName.toLowerCase() === "th")) return;
    add(
      $(cells[0]).text(),
      cells.slice(1).map((_, c) => cellText($, c)).get().join(" "),
    );
  });

  // 2) Listas de definición <dl><dt>etiqueta</dt><dd>valor</dd>.
  $("dt").each((_, dt) => {
    const dd = $(dt).next("dd");
    if (dd.length) add($(dt).text(), cellText($, dd[0]));
  });

  // 3) Etiqueta y valor en el MISMO bloque, marcada con negrita:
  //    <td><strong>Main customer</strong> Ana Torres</td>
  $("td, th, p, div, li").each((_, el) => {
    const strong = $(el).children("strong, b").first();
    if (!strong.length) return;
    const label = strong.text();
    const clone = $(el).clone();
    clone.children("strong, b").first().remove();
    const value = normalize(clone.text()).replace(/^[\s:·-]+/, "");
    if (label && value) add(label, value);
  });

  // 4) "Etiqueta: valor" en una sola celda, sin negrita ni celdas separadas.
  $("td, th, p, li").each((_, el) => {
    if ($(el).children("td, th, table, strong, b").length) return;
    const m = normalize($(el).text()).match(/^([\p{L} ./']{2,40}?)\s*:\s*(.+)$/u);
    if (m) add(m[1], m[2]);
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

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** El cuerpo utilizable de un email: HTML, o el texto plano envuelto. */
export function bestBody(bodyHtml: string | null, bodyText?: string | null): string {
  if (bodyHtml) return bodyHtml;
  if (bodyText) return `<pre>${escapeHtml(bodyText)}</pre>`;
  return "";
}

/** Todo el texto plano del email, con espacios normalizados. */
export function fullText(html: string): string {
  const $ = cheerio.load(html);
  // Sin esto, el texto de bloques contiguos se pega ("Imke Mevissen"+"Contacto"
  // → "Imke MevissenContacto") y arruina la extracción de nombres y campos.
  $("br").replaceWith(" ");
  $("p, div, tr, td, th, li, h1, h2, h3, h4, h5, h6, table, span").append(" ");
  return normalize($.root().text());
}

// Saludos y avisos genéricos que no son el nombre del producto.
const NON_PRODUCT_HEADING =
  /^(hi|hello|hola|dear)\b|supply partner|great news|booking|cancelled|reserva|s\.l\.u|s\.l\./i;

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
