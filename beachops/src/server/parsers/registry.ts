import { bokunParser } from "./bokun";
import { gygParser } from "./gyg";
import { EmailInput, EmailParser } from "./types";

export const parsers: EmailParser[] = [gygParser, bokunParser];

export function detectParser(email: EmailInput): EmailParser | null {
  return parsers.find((p) => p.detect(email)) ?? null;
}

/** Heurística: un email sin parser conocido, ¿parece una reserva? */
export function looksLikeBooking(email: EmailInput): boolean {
  const haystack = `${email.subject ?? ""}`.toLowerCase();
  return /(booking|reserva|reservation|cancel)/.test(haystack);
}
