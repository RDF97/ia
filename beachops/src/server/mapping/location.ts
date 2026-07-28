import { Location, Product } from "../db/schema";

/** Minúsculas, sin acentos y con espacios normalizados. */
export function normalizeText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Frases adicionales que identifican una playa en el texto del email, además de
 * su propio nombre. Clave = nombre de la playa normalizado.
 */
const ALIASES: Record<string, string[]> = {
  "cala santanyi": ["es pontas", "pontas", "santanyi"],
  // Ojo: NO se añade "parc natural de mondrago" como alias. Playa Barca está
  // DENTRO de ese parque, así que el nombre del parque no identifica la playa;
  // si se usara, "Playa Barca (Parc Natural de Mondragó)" iría a Mondragó.
  mondrago: ["mondrago"],
  "playa barca": ["playa barca", "platja barca", "platja de sa barca", "playa de la barca"],
};

/** Etiquetas del email que anuncian el punto de salida real. */
const MEETING_POINT_RE =
  /(punto de (encuentro|salida)|lugar de (encuentro|salida)|meeting point|departure point|treffpunkt|point de rendez-vous)/i;

/** Todas las frases que delatan a esta playa (su nombre + alias conocidos). */
function phrasesFor(location: Location): string[] {
  const name = normalizeText(location.name);
  // Nombres compuestos antiguos ("playa barca / mondrago") valen por sus partes.
  const parts = name.split(/\s*\/\s*/).filter(Boolean);
  return [...new Set([name, ...parts, ...(ALIASES[name] ?? [])])];
}

/** ¿Aparece la frase como palabras completas dentro del texto? */
function mentions(text: string, phrase: string): boolean {
  if (!phrase) return false;
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(text);
}

/**
 * Deduce a qué playa va la reserva leyendo el texto del email (producto, asunto
 * y cuerpo). Cuando el email menciona varias (p. ej. "Parc Natural de Mondragó,
 * Playa Barca"), gana la frase MÁS ESPECÍFICA (la más larga), que es la que
 * indica el punto de salida real.
 *
 * @returns la playa detectada, o null si el email no nombra ninguna.
 */
export function detectLocation(locations: Location[], text: string): Location | null {
  const active = locations.filter((l) => l.active);
  // 1) Si el email trae "punto de encuentro / meeting point", manda esa línea:
  // es donde sale la excursión de verdad.
  for (const window of meetingPointWindows(text)) {
    const hit = longestMatch(active, window);
    if (hit) return hit;
  }
  // 2) Si no, se busca en todo el email y gana la mención más específica.
  return longestMatch(active, text);
}

/** Trozos de texto que siguen a una etiqueta de punto de encuentro. */
function meetingPointWindows(text: string): string[] {
  const windows: string[] = [];
  const re = new RegExp(MEETING_POINT_RE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    windows.push(text.slice(m.index, m.index + 160));
  }
  return windows;
}

function longestMatch(locations: Location[], text: string): Location | null {
  const haystack = normalizeText(text);
  let best: { location: Location; length: number } | null = null;
  for (const location of locations) {
    for (const phrase of phrasesFor(location)) {
      if (mentions(haystack, phrase) && (!best || phrase.length > best.length)) {
        best = { location, length: phrase.length };
      }
    }
  }
  return best?.location ?? null;
}

/**
 * El producto equivalente dentro de otra playa. Los productos son por playa, así
 * que al mover una reserva a la playa detectada hay que coger SU producto (el
 * "Kayak" de esa playa), no el de la playa original.
 */
export function productInLocation(
  products: Product[],
  locationId: string,
  preferredName?: string | null,
): Product | null {
  const candidates = products.filter((p) => p.active && p.locationId === locationId);
  if (candidates.length === 0) return null;
  if (preferredName) {
    const target = normalizeText(preferredName);
    const exact = candidates.find((p) => normalizeText(p.name) === target);
    if (exact) return exact;
  }
  return candidates.find((p) => p.kind === "tour") ?? candidates[0];
}
