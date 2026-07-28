import { parseBokunDate } from "./dates";
import { bestBody, extractLabeledFields, fullText } from "./html";
import { parsePhone } from "./phone";
import { EmailInput, EmailKind, EmailParser, ParseError, ParsedBooking } from "./types";

const SUBJECT_RE =
  /(New|Cancelled|Updated|Amended) booking:.*\((SEC-T?\w+)\)(?:\s*Ext\. booking ref:?\s*(\d+))?/i;

export const bokunParser: EmailParser = {
  source: "bokun_viator",

  detect(email: EmailInput): boolean {
    const from = email.fromAddress?.toLowerCase() ?? "";
    if (from.includes("bokun.io") || from.includes("bokun.com")) return true;
    return SUBJECT_RE.test(email.subject ?? "");
  },

  classify(email: EmailInput): EmailKind {
    const subject = email.subject ?? "";
    const text = fullText(email.bodyHtml ?? "").toLowerCase();
    if (/cancelled booking/i.test(subject) || text.includes("booking was cancelled")) {
      return "cancellation";
    }
    if (/(updated|amended) booking/i.test(subject) || text.includes("booking was updated")) {
      return "amendment";
    }
    if (/new booking/i.test(subject) || text.includes("booking was just created")) return "new";
    return "other";
  },

  parse(email: EmailInput): ParsedBooking {
    const kind = this.classify(email);
    const html = bestBody(email.bodyHtml, email.bodyText);
    const fields = extractLabeledFields(html);
    const subjectMatch = (email.subject ?? "").match(SUBJECT_RE);

    const ref =
      fields.get("booking ref")?.match(/VIA-\w+|\S+/)?.[0] ??
      subjectMatch?.[2];
    if (!ref) throw new ParseError("externalRef", "No se encontró la referencia de Bókun");

    const dateRaw = fields.get("date") ?? email.subject ?? "";
    const parsedDate = parseBokunDate(dateRaw);
    if (!parsedDate && kind === "new") {
      throw new ParseError("activityDate", `Fecha no reconocida: ${dateRaw}`);
    }

    const productRaw = fields.get("product") ?? fields.get("rate") ?? "";
    const productMatch = productRaw.match(/^(\w+)\s*-\s*(.+)$/);
    const rawProductName = productMatch ? productMatch[2].trim() : productRaw.trim();
    const externalProductCode = productMatch?.[1];
    if (!rawProductName && kind === "new") {
      throw new ParseError("rawProductName", "No se encontró el producto en el email");
    }

    const pax = fields.get("pax") ?? "";
    const adults = pax.match(/(\d+)\s*Adult/i)?.[1];
    const children = pax.match(/(\d+)\s*(Child|Kid|Infant)/i)?.[1];

    // "Doe, Jane" → "Jane Doe"
    const customerRaw = fields.get("customer") ?? "";
    const customerName = customerRaw.includes(",")
      ? customerRaw.split(",").reverse().map((s) => s.trim()).join(" ")
      : customerRaw || undefined;

    const { phone, country } = parsePhone(fields.get("customer phone"));

    const notes = fields.get("notes");
    const amount = notes?.match(/(?:Viator|Total)\s+amount:?\s*([A-Z]{3})\s*([\d.,]+)/i);

    const guided = fields.get("guided languages")?.match(/language:\s*(\w+)/i)?.[1];

    return {
      source: "bokun_viator",
      kind,
      channel: fields.get("booking channel") ?? fields.get("sold by") ?? "Bókun",
      externalRef: ref,
      externalRefSecondary: fields.get("product booking ref") ?? subjectMatch?.[2],
      activityDate: parsedDate?.date,
      activityTime: parsedDate?.time,
      rawProductName: rawProductName || "Producto Bókun",
      externalProductCode,
      paxAdults: adults ? Number(adults) : 0,
      paxChildren: children ? Number(children) : 0,
      customerName,
      customerEmail: fields.get("customer email")?.match(/\S+@\S+\.\w+/)?.[0],
      customerPhone: phone,
      customerCountry: country,
      customerLanguage: guided,
      priceAmount: amount?.[2]?.replace(",", ""),
      priceCurrency: amount?.[1]?.toUpperCase() ?? "EUR",
      notes,
    };
  },
};
