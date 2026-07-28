import { bestBody, fullText } from "./html";
import { parsePhone } from "./phone";
import { EmailInput, EmailKind, EmailParser, ParseError, ParsedBooking } from "./types";

/**
 * Freedome (freedome.eu) — emails en español desde socios@freedome.eu:
 *   "Tienes una nueva reserva #3576686" / "Reserva confirmada #3576686"
 *   ID del pedido #3576686 · Actividad: … · Fecha y hora: 29/07/2026 15:00
 *   Participantes: 4 x Participantes · Total 188,00 € · Nombre/Teléfono/Correo
 */
export const freedomeParser: EmailParser = {
  source: "freedome",

  detect(email: EmailInput): boolean {
    const from = email.fromAddress?.toLowerCase() ?? "";
    if (from.includes("freedome")) return true;
    return (email.bodyHtml ?? "").includes("freedome.eu") && /#\d{5,}/.test(email.subject ?? "");
  },

  classify(email: EmailInput): EmailKind {
    const subject = (email.subject ?? "").toLowerCase();
    // Ojo: el cuerpo siempre contiene "Cancelación: <política>"; solo cuenta
    // una cancelación real (en el asunto o como frase explícita).
    if (/cancelad[ao]|anulad[ao]/.test(subject)) return "cancellation";
    const text = fullText(email.bodyHtml ?? "").toLowerCase();
    if (/(reserva|pedido|solicitud)[^.]{0,40}ha sido (cancelad|anulad)/.test(text)) {
      return "cancellation";
    }
    if (/modificad[ao]|cambio de reserva/.test(subject)) return "amendment";
    if (/reserva|solicitud/.test(`${subject} ${text}`)) return "new";
    return "other";
  },

  parse(email: EmailInput): ParsedBooking {
    const kind = this.classify(email);
    const text = fullText(bestBody(email.bodyHtml, email.bodyText));

    const ref =
      text.match(/ID del pedido\s*#?\s*(\d+)/i)?.[1] ??
      email.subject?.match(/#\s*(\d+)/)?.[1];
    if (!ref) throw new ParseError("externalRef", "No se encontró el ID del pedido de Freedome");

    const dateMatch = text.match(
      /Fecha y hora:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/i,
    );
    if (!dateMatch && kind === "new") {
      throw new ParseError("activityDate", "No se encontró 'Fecha y hora' en el email");
    }
    const activityDate = dateMatch
      ? `${dateMatch[3]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[1].padStart(2, "0")}`
      : undefined;
    const activityTime = dateMatch?.[4]
      ? `${dateMatch[4].padStart(2, "0")}:${dateMatch[5]}`
      : undefined;

    const pax = text.match(/Participantes:\s*(\d+)\s*x/i)?.[1];
    const rawProductName =
      text.match(/Actividad:\s*(.+?)(?:\s*Fecha y hora|$)/i)?.[1]?.trim() ?? "Producto Freedome";
    const total = text.match(/Total\s*([\d.]+,\d{2}|\d+(?:\.\d{2})?)\s*€/i)?.[1];
    const customerName = text.match(/Nombre:\s*(.+?)(?:\s*Teléfono|\s*Correo|$)/i)?.[1]?.trim();
    // El primer teléfono/correo es el del cliente (el de soporte sale después)
    const phoneRaw = text.match(/Teléfono:\s*(\+?[\d][\d\s.-]{6,})/i)?.[1];
    const customerEmail = text.match(/Correo electrónico:\s*([^\s@]+@[^\s]+)/i)?.[1];
    const { phone, country } = parsePhone(phoneRaw);

    return {
      source: "freedome",
      kind,
      channel: "Freedome",
      externalRef: ref,
      activityDate,
      activityTime,
      rawProductName,
      paxAdults: pax ? Number(pax) : 0,
      paxChildren: 0,
      customerName,
      customerEmail,
      customerPhone: phone,
      customerCountry: country,
      customerLanguage: "Spanish",
      priceAmount: total?.replace(/\./g, "").replace(",", "."),
      priceCurrency: "EUR",
    };
  },
};
