import { LabeledFields } from "./html";
import { parsePhone } from "./phone";

export type Customer = {
  name?: string;
  email?: string;
  phone?: string;
  country?: string;
  language?: string;
};

/**
 * Extracción de los datos del cliente por capas, para que funcione con
 * cualquier plantilla: primero por etiqueta (tablas), y si la plataforma cambia
 * el formato, rebuscando en el texto plano del email. El objetivo es que NUNCA
 * falten nombre, país y teléfono en el cuadro.
 */

const NAME_LABELS = [
  "main customer", "customer name", "customer", "lead traveller", "lead traveler",
  "traveller", "traveler", "guest name", "guest", "passenger", "booked by",
  "nombre del cliente", "nombre y apellidos", "nombre", "cliente", "titular", "name",
];
const PHONE_LABELS = [
  "customer phone", "phone number", "phone", "telephone", "mobile", "cell",
  "contact number", "telefono", "teléfono", "movil", "móvil", "contacto",
];
const EMAIL_LABELS = [
  "customer email", "email address", "e-mail", "email", "correo electronico",
  "correo electrónico", "correo",
];
const COUNTRY_LABELS = ["country", "pais", "país", "nationality", "nacionalidad"];
const LANGUAGE_LABELS = ["guided languages", "language", "languages", "idioma"];

/** Primer campo cuya etiqueta coincide (o contiene) alguna de las candidatas. */
function pickLabel(fields: LabeledFields, candidates: string[]): string | undefined {
  for (const candidate of candidates) {
    const exact = fields.get(candidate);
    if (exact?.trim()) return exact.trim();
  }
  for (const candidate of candidates) {
    for (const [key, value] of fields) {
      if (key.includes(candidate) && value.trim()) return value.trim();
    }
  }
  return undefined;
}

// Textos que parecen nombre pero no lo son (saludos, la propia empresa…).
const NOT_A_NAME =
  /^(hi|hello|hola|dear|estimad|buenos|buenas)\b|secret point|s\.?l\.?u|getyourguide|viator|bokun|freedome|booking|reserva|total|adult|child|n\/a|none/i;

// Etiquetas que suelen venir pegadas detrás del nombre cuando el email no usa
// tablas ("Nombre: Ana Torres Teléfono: +34…").
const TRAILING_LABEL =
  /\s(?=(?:tel[eé]fono|telephone|phone|m[oó]vil|mobile|cell|contacto?|contact|email|e-mail|correo|language|idioma|pa[ií]s|country|nationality|reference|referencia|date|fecha)\b)/i;

/** Recorta el candidato a nombre: corta en la siguiente etiqueta y en dígitos. */
function cleanNameCandidate(raw: string): string {
  let v = raw.split(TRAILING_LABEL)[0];
  v = v.split(/\s*\+?\d/)[0]; // el teléfono suele ir pegado detrás
  return v.replace(/[\s,;.:|-]+$/, "").trim();
}

function looksLikeName(value: string): boolean {
  const v = value.trim();
  if (v.length < 2 || v.length > 60) return false;
  if (/[@\d]/.test(v)) return false;
  if (NOT_A_NAME.test(v)) return false;
  return /\p{L}/u.test(v);
}

/** De un bloque multilínea ("Nombre\nPhone: …\nLanguage: …") saca el nombre. */
function nameFromBlock(block: string): string | undefined {
  const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
  const clean = lines
    .map((l) => l.replace(/^(name|nombre|customer|cliente)\s*:\s*/i, ""))
    .filter((l) => !/^(phone|tel|telefono|teléfono|language|idioma|email|correo|country|pais|país)\s*:/i.test(l))
    .map(cleanNameCandidate);
  return clean.find(looksLikeName);
}

/** Todos los teléfonos plausibles del texto, en orden de aparición. */
function phonesInText(text: string): string[] {
  const found: string[] = [];
  for (const m of text.matchAll(/\+\d[\d\s().-]{6,}\d/g)) {
    const { phone } = parsePhone(m[0]);
    if (phone) found.push(m[0]);
  }
  return found;
}

/** Nombre escrito en línea ("Nombre: Ana Torres", "Booking for Ana Torres"). */
function nameInText(text: string): string | undefined {
  const patterns = [
    /(?:nombre|name|cliente|customer|guest|traveller|traveler|titular|passenger)\s*:\s*([^\n:;|]{2,60})/i,
    /(?:booking|reserva)\s+(?:for|de|a nombre de)\s+([^\n:;|]{2,60})/i,
  ];
  for (const re of patterns) {
    const raw = text.match(re)?.[1];
    if (!raw) continue;
    const value = cleanNameCandidate(raw);
    if (value && looksLikeName(value)) return value;
  }
  return undefined;
}

// Nombre de país (en varios idiomas) → ISO-2, para cuando el email lo escribe
// en texto ("País: Alemania") en vez de venir por el prefijo telefónico.
const COUNTRY_CODES = [
  "ES","GB","IE","FR","DE","AT","CH","IT","PT","NL","BE","LU","DK","SE","NO","FI","IS",
  "PL","CZ","SK","HU","RO","BG","GR","HR","SI","RS","EE","LV","LT","UA","RU","TR",
  "US","CA","MX","BR","AR","CL","CO","PE","UY","VE",
  "MA","TN","DZ","EG","ZA","IL","SA","AE","QA","KW",
  "AU","NZ","JP","CN","KR","IN","TH","SG","PH","ID","MY",
];
const COUNTRY_BY_NAME: Map<string, string> = (() => {
  const map = new Map<string, string>();
  for (const locale of ["es", "en", "de", "fr", "it", "pt", "nl"]) {
    let dn: Intl.DisplayNames;
    try {
      dn = new Intl.DisplayNames([locale], { type: "region" });
    } catch {
      continue;
    }
    for (const code of COUNTRY_CODES) {
      const name = dn.of(code);
      if (name && name !== code) map.set(normalize(name), code);
    }
  }
  return map;
})();

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export function countryToIso(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const v = value.trim();
  if (/^[A-Z]{2}$/.test(v) && COUNTRY_CODES.includes(v)) return v;
  return COUNTRY_BY_NAME.get(normalize(v));
}

/**
 * Datos del cliente a partir de las etiquetas del email y, como respaldo, de su
 * texto plano. `preferredPhone` permite a un parser pasar el teléfono que ya
 * localizó por su propia vía.
 */
export function extractCustomer(
  fields: LabeledFields,
  text: string,
  opts: { block?: string; preferredPhone?: string } = {},
): Customer {
  const block = opts.block ?? pickLabel(fields, NAME_LABELS) ?? "";

  // Nombre: bloque etiquetado → etiqueta suelta → texto del email.
  const name =
    nameFromBlock(block) ??
    (looksLikeName(block) ? block.trim() : undefined) ??
    nameInText(text);

  // Email: del bloque, de la etiqueta o el primero del texto (el relay de GYG
  // tiene prioridad porque es el del cliente, no el de soporte).
  const email =
    block.match(/\S+@reply\.\S+\.\w+/)?.[0] ??
    text.match(/\S+@reply\.\S+\.\w+/)?.[0] ??
    pickLabel(fields, EMAIL_LABELS)?.match(/\S+@\S+\.\w+/)?.[0] ??
    block.match(/\S+@\S+\.\w+/)?.[0] ??
    text.match(/\S+@\S+\.\w+/)?.[0];

  // Teléfono: el que dé el parser → etiqueta → bloque → primero del texto.
  const phoneRaw =
    opts.preferredPhone ??
    pickLabel(fields, PHONE_LABELS) ??
    block.match(/(?:phone|tel|telefono|teléfono|movil|móvil)\s*:?\s*(\+?[\d][\d\s().-]{6,})/i)?.[1] ??
    phonesInText(block)[0] ??
    phonesInText(text)[0];
  const { phone, country: countryFromPhone } = parsePhone(phoneRaw);

  // País: el del prefijo telefónico manda; si no, el escrito en el email.
  const country = countryFromPhone ?? countryToIso(pickLabel(fields, COUNTRY_LABELS));

  const language =
    pickLabel(fields, LANGUAGE_LABELS)?.match(/([A-Za-zÀ-ÿ]{3,})/)?.[1] ??
    block.match(/(?:language|idioma)\s*:\s*(\w+)/i)?.[1];

  return { name, email, phone, country, language };
}
