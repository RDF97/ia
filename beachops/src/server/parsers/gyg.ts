import { parseGygDate } from "./dates";
import { bestBody, extractLabeledFields, fullText, productHeading } from "./html";
import { parsePhone } from "./phone";
import { EmailInput, EmailKind, EmailParser, ParseError, ParsedBooking } from "./types";

const REF_RE = /\bGYG[A-Z0-9]{6,}\b/;

export const gygParser: EmailParser = {
  source: "getyourguide",

  detect(email: EmailInput): boolean {
    const from = email.fromAddress?.toLowerCase() ?? "";
    if (from.includes("getyourguide")) return true;
    const haystack = `${email.subject ?? ""} ${email.bodyHtml ?? ""}`;
    return haystack.includes("reply.getyourguide.com") || REF_RE.test(email.subject ?? "");
  },

  classify(email: EmailInput): EmailKind {
    const subject = (email.subject ?? "").toLowerCase();
    const from = (email.fromAddress ?? "").toLowerCase();
    // Consultas/mensajes de clientes via la mensajería de GYG
    if (
      from.includes("via getyourguide") ||
      /\(directions\)|has messaged|sent you a message|new message/.test(subject)
    ) {
      return "message";
    }
    if (/review on getyourguide|new review/.test(subject)) return "other";
    const text = `${subject} ${fullText(email.bodyHtml ?? "")}`.toLowerCase();
    if (/cancel(ló|led|ed|ada|ación|lation)/.test(text)) return "cancellation";
    if (/(modified|amended|has been changed|updated booking|detail change|booking changes)/.test(text)) {
      return "amendment";
    }
    if (/(booking|reserva)/.test(text)) return "new";
    return "other";
  },

  parse(email: EmailInput): ParsedBooking {
    const kind = this.classify(email);
    const html = bestBody(email.bodyHtml, email.bodyText);
    const fields = extractLabeledFields(html);
    const text = fullText(html);

    // La referencia puede venir en el cuerpo o solo en el asunto
    const ref =
      fields.get("reference number")?.match(REF_RE)?.[0] ??
      text.match(REF_RE)?.[0] ??
      email.subject?.match(REF_RE)?.[0];
    if (!ref) throw new ParseError("externalRef", "No se encontró la referencia GYG");

    const dateRaw =
      fields.get("date") ??
      text.match(/Date:?\s*([A-Za-z]+ \d{1,2},\s*\d{4}(?:\s+\d{1,2}:\d{2}\s*(?:AM|PM)?)?)/i)?.[1];
    const parsedDate = dateRaw ? parseGygDate(dateRaw) : null;
    // Solo las altas exigen fecha; una cancelación/modificación se resuelve
    // por referencia contra la reserva existente.
    if (!parsedDate && kind === "new") {
      throw new ParseError("activityDate", `Fecha no reconocida: ${dateRaw}`);
    }

    const participants = fields.get("number of participants") ?? text;
    const adults = participants.match(/(\d+)\s*x\s*Adult/i)?.[1];
    const children = participants.match(/(\d+)\s*x\s*(Child|Kid|Infant)/i)?.[1];

    const customerBlock = fields.get("main customer") ?? "";
    const customerLines = customerBlock.split("\n").map((l) => l.trim()).filter(Boolean);
    const customerName = customerLines.find((l) => !l.includes("@") && !/^(Phone|Language):/i.test(l));
    const customerEmail =
      customerBlock.match(/\S+@reply\.getyourguide\.com/)?.[0] ??
      customerBlock.match(/\S+@\S+\.\w+/)?.[0];
    const phoneRaw = customerBlock.match(/Phone:\s*([+\d][\d\s-]*)/i)?.[1];
    const language = customerBlock.match(/Language:\s*(\w+)/i)?.[1];
    const { phone, country } = parsePhone(phoneRaw);

    const price = (fields.get("price") ?? text).match(/€\s*([\d.,]+)/)?.[1];

    const rawProductName = productHeading(html) ?? "Producto GetYourGuide";

    return {
      source: "getyourguide",
      kind,
      channel: "GetYourGuide",
      externalRef: ref,
      activityDate: parsedDate?.date,
      activityTime: parsedDate?.time,
      rawProductName,
      paxAdults: adults ? Number(adults) : 0,
      paxChildren: children ? Number(children) : 0,
      customerName,
      customerEmail,
      customerPhone: phone,
      customerCountry: country,
      customerLanguage: language,
      priceAmount: price?.replace(",", ""),
      priceCurrency: "EUR",
    };
  },
};
