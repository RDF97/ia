// Import con nombre: el default rompe con el empaquetado CJS/ESM del servidor
import { parsePhoneNumberFromString } from "libphonenumber-js";

/** Normaliza un teléfono y deriva el país (ISO-2) del prefijo. */
export function parsePhone(raw: string | undefined | null): {
  phone?: string;
  country?: string;
} {
  if (!raw) return {};
  // Bókun antepone el país en letras: "US+1 2105550000" → "+1 2105550000"
  const cleaned = raw.replace(/^[A-Z]{2}(?=\+)/, "").trim();
  const withPlus = cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
  const parsed = parsePhoneNumberFromString(withPlus);
  if (parsed?.isPossible()) {
    return { phone: parsed.number, country: parsed.country };
  }
  return { phone: cleaned || undefined };
}
