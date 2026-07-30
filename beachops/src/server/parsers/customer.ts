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

/**
 * Etiquetas de OTRO tipo de dato. Sin este veto, buscar "customer" casaba con
 * "customer email", "customer reference" o "customer comments" y devolvía como
 * nombre una referencia o un comentario (nombre falso en el cuadro).
 */
const OTHER_FIELD =
  /e-?mail|correo|phone|tel[eé]fono|m[oó]vil|mobile|reference|referencia|comment|coment|note|nota|language|idioma|country|pa[ií]s|date|fecha|time|hora|price|precio|amount|importe|count|cantidad|pax|adult|child/i;

/** Primer campo cuya etiqueta coincide (o contiene) alguna de las candidatas. */
function pickLabel(
  fields: LabeledFields,
  candidates: string[],
  opts: { rejectOtherFields?: boolean } = {},
): string | undefined {
  for (const candidate of candidates) {
    const exact = fields.get(candidate);
    if (exact?.trim()) return exact.trim();
  }
  for (const candidate of candidates) {
    for (const [key, value] of fields) {
      if (!key.includes(candidate) || !value.trim()) continue;
      // "customer" no debe robar el valor de "customer email".
      if (opts.rejectOtherFields && !candidates.includes(key) && OTHER_FIELD.test(key)) continue;
      return value.trim();
    }
  }
  return undefined;
}

/**
 * Textos que NO son el nombre del cliente. Ojo: aquí solo van saludos, la propia
 * empresa y palabras de plantilla. Los nombres de plataforma (getyourguide,
 * viator…) NO pueden estar: el nombre suele venir pegado al correo relay del
 * cliente ("Ana Torres customer-x@reply.getyourguide.com") y descartarlo por eso
 * era justo la causa de que el cuadro saliera sin nombres. Los correos se quitan
 * antes de juzgar el candidato (ver cleanNameCandidate).
 */
const NOT_A_NAME =
  /^(hi|hello|hola|dear|estimad[oa]s?|buenos|buenas)\b(?=\s*[,!:]|\s*$)|secret point|s\.?l\.?u\b|^(booking|reserva|total|adults?|child(ren)?|pax|n\/a|none|sin nombre|e-?mail|correo|phone|tel[eé]fono|name|nombre|customer|cliente|country|pa[ií]s|language|idioma|date|fecha|time|hora|price|precio|reference|referencia)$/i;

/** Palabras de producto/actividad: un título de excursión no es un cliente. */
const PRODUCT_WORDS =
  /\b(kayak|paddle|surf|snorkel|tour|excursi[oó]n|mallorca|paseo|alquiler|rental|paddleboard)\b/i;

// Etiquetas que suelen venir pegadas detrás del nombre cuando el email no usa
// tablas ("Nombre: Ana Torres Teléfono: +34…").
const TRAILING_LABEL =
  /\s(?=(?:tel[eé]fono|telephone|phone|m[oó]vil|mobile|cell|contacto?|contact|email|e-mail|correo|language|idioma|pa[ií]s|country|nationality|reference|referencia|date|fecha|pax|adults?|participants?)\b)/i;

/**
 * Recorta el candidato a nombre: quita correos y URLs, corta en la siguiente
 * etiqueta y en el teléfono que suele ir pegado detrás.
 */
/** Quita correos y enlaces, que contaminan cualquier candidato a nombre. */
function stripContacts(raw: string): string {
  return raw
    .replace(/\S+@\S+\.\w+/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanNameCandidate(raw: string): string {
  // Los correos y enlaces se eliminan ANTES de nada: si no, el dominio de la
  // plataforma contamina el candidato y lo tumba.
  let v = stripContacts(raw);
  v = v.split(TRAILING_LABEL)[0];
  v = v.split(/\s+\+?\d/)[0]; // el teléfono suele ir detrás, tras un espacio
  return v.replace(/\s+/g, " ").replace(/^[\s,;.:|·-]+|[\s,;.:|·-]+$/g, "").trim();
}

function looksLikeName(value: string): boolean {
  const v = value.trim();
  if (v.length < 2 || v.length > 60) return false;
  if (/[@\d]/.test(v)) return false;
  if (NOT_A_NAME.test(v)) return false;
  if (PRODUCT_WORDS.test(v)) return false;
  return /\p{L}/u.test(v);
}

/**
 * Palabras que nunca forman parte del nombre de un cliente: meses, días y
 * vocabulario de plantilla de email. Sin esta guarda, la búsqueda de último
 * recurso confunde cosas como "Date July" con un nombre.
 */
const STOPWORDS = new Set(
  (
    "date time total price precio importe booking reserva reference referencia " +
      "participants participantes adult adults adulto adultos child children nino ninos " +
      "phone telefono email correo language idioma country pais nationality " +
      "january february march april may june july august september october november december " +
      "enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre " +
      "monday tuesday wednesday thursday friday saturday sunday " +
      "lunes martes miercoles jueves viernes sabado domingo " +
      "hi hello hola dear urgent new nueva cancelled cancelada confirmed confirmada " +
      "customer cliente guest traveller traveler main pax voucher hotel playa cala " +
      "meeting point punto encuentro salida departure am pm"
  ).split(" "),
);

function isStopword(word: string): boolean {
  return STOPWORDS.has(normalize(word).replace(/[^\p{L}]/gu, ""));
}

/** ¿Parece un nombre de persona? (2–4 palabras capitalizadas, sin vocabulario de plantilla) */
function looksLikePersonName(value: string): boolean {
  if (!looksLikeName(value)) return false;
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 5) return false;
  if (words.some(isStopword)) return false;
  const capitalized = words.filter((w) => /^[\p{Lu}]/u.test(w)).length;
  return capitalized >= 2;
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

function firstIfName(value: string): string | undefined {
  return value && looksLikeName(value) ? value : undefined;
}

/**
 * Último recurso: ninguna etiqueta dio el nombre, así que se busca en los valores
 * de los campos y en el texto algo que parezca nombre de persona (dos o más
 * palabras capitalizadas, sin palabras de producto). Es lo que evita que el
 * cuadro salga con "(sin nombre)" cuando el email sí lo trae.
 */
function personNameNearby(fields: LabeledFields, text: string): string | undefined {
  // 1) Valores de campos cuya etiqueta no reconocimos pero cuyo valor sí parece
  //    un nombre (p. ej. una fila "Booked by" que no está en la lista).
  for (const [key, value] of fields) {
    if (/date|hora|time|precio|price|total|ref|producto|product|pax|adult|child|idioma|language|pa[ií]s|country|tel|phone|email|correo/i.test(key)) {
      continue;
    }
    const candidate = cleanNameCandidate(value);
    if (looksLikePersonName(candidate)) return candidate;
  }
  // 2) En una tabla sin cabecera ("Ana Torres | ana@x.com") el nombre acaba
  //    siendo la CLAVE del campo, no el valor: se rescata de ahí.
  for (const [key] of fields) {
    const candidate = cleanNameCandidate(key);
    if (looksLikePersonName(candidate)) return candidate;
  }
  // 3) En el texto: la primera secuencia que parezca nombre y apellido. Se
  //    prueban también subsecuencias, porque el nombre suele venir pegado a
  //    palabras de plantilla ("Name Email Ana Torres" → "Ana Torres").
  for (const m of text.matchAll(/\b[\p{Lu}][\p{Ll}'.-]{1,20}(?:\s+[\p{Lu}][\p{Ll}'.-]{1,20}){1,4}\b/gu)) {
    // Aquí NO se corta por etiqueta: hacerlo se comía el nombre cuando venía
    // detrás ("Name Email Ana Torres" quedaba en "Name"). La ventana de palabras
    // y las palabras vetadas ya descartan lo que no es nombre.
    const words = stripContacts(m[0]).split(/\s+/).filter(Boolean);
    for (let size = Math.min(3, words.length); size >= 2; size--) {
      for (let i = 0; i + size <= words.length; i++) {
        const candidate = words.slice(i, i + size).join(" ");
        if (looksLikePersonName(candidate)) return candidate;
      }
    }
  }
  return undefined;
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
    // Sin dos puntos: "Main customer Ana Torres", "Guest Ana Torres"
    /(?:main customer|customer name|lead traveller|lead traveler|nombre del cliente|customer|cliente|guest|traveller|traveler|titular)\s+([\p{Lu}][\p{L}'.-]+(?:\s+[\p{Lu}][\p{L}'.-]+){1,3})/u,
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
  const block = opts.block ?? pickLabel(fields, NAME_LABELS, { rejectOtherFields: true }) ?? "";

  // Nombre, por capas: bloque etiquetado → etiqueta suelta → texto del email →
  // y, como último recurso, un encabezado o línea que parezca nombre de persona
  // (así no se queda vacío cuando el email no etiqueta nada).
  const name =
    nameFromBlock(block) ??
    firstIfName(cleanNameCandidate(block)) ??
    nameInText(text) ??
    personNameNearby(fields, text);

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
