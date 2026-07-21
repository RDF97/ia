export type BookingSource = "getyourguide" | "bokun_viator" | "freedome";
export type EmailKind = "new" | "cancellation" | "amendment" | "message" | "other";

/** Lo mínimo de un email para poder parsearlo (subconjunto de raw_emails). */
export type EmailInput = {
  fromAddress: string | null;
  subject: string | null;
  bodyHtml: string | null;
  bodyText?: string | null;
};

export type ParsedBooking = {
  source: BookingSource;
  kind: EmailKind;
  channel: string;
  externalRef: string;
  externalRefSecondary?: string;
  /** Fecha de la actividad en hora local (YYYY-MM-DD). Puede faltar en
   *  cancelaciones/modificaciones: se resuelve con la reserva existente. */
  activityDate?: string;
  /** Hora local HH:MM, si el email la trae */
  activityTime?: string;
  rawProductName: string;
  externalProductCode?: string;
  paxAdults: number;
  paxChildren: number;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerCountry?: string;
  customerLanguage?: string;
  priceAmount?: string;
  priceCurrency?: string;
  notes?: string;
};

export class ParseError extends Error {
  constructor(
    public field: string,
    message: string,
  ) {
    super(message);
    this.name = "ParseError";
  }
}

export interface EmailParser {
  source: BookingSource;
  /** ¿Este email es de esta plataforma? (por From/asunto) */
  detect(email: EmailInput): boolean;
  /** nueva / cancelación / modificación / otro */
  classify(email: EmailInput): EmailKind;
  /** Extrae la reserva. Lanza ParseError si falta un campo imprescindible. */
  parse(email: EmailInput): ParsedBooking;
}
