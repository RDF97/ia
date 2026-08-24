import { bokunParser } from "./bokun";
import { freedomeParser } from "./freedome";
import { gygParser } from "./gyg";
import { bestBody, fullText } from "./html";
import { EmailInput, EmailParser } from "./types";

export const parsers: EmailParser[] = [gygParser, bokunParser, freedomeParser];

export function detectParser(email: EmailInput): EmailParser | null {
  return parsers.find((p) => p.detect(email)) ?? null;
}

/** Qué es un email que ninguna plataforma conocida reclama. */
export type UnknownKind = "booking" | "message";

/** Una respuesta o un reenvío siempre es alguien escribiendo, no una reserva. */
const REPLY_RE = /^\s*(re|rv|fw|fwd)\s*:/i;

/**
 * Localizador: 6+ caracteres en mayúsculas con AL MENOS una letra y un dígito
 * ("GYGWZAVH62MX", "VIA-96827518", "ABC-12345"). Exigir letra y dígito deja
 * fuera fechas ("2026-08-20") y palabras sueltas ("RESERVA").
 */
const REF_TOKEN_RE = /\b(?=[A-Z0-9-]{6,}\b)(?=[A-Z0-9-]*[A-Z])(?=[A-Z0-9-]*\d)[A-Z0-9-]+\b/;

/** Etiquetas que solo aparecen en un email de reserva de verdad. */
const BOOKING_LABEL_RE =
  /(booking (?:reference|number|id|code)|reference number|n[uú]mero de reserva|c[oó]digo de reserva|localizador|confirmation (?:number|code)|number of participants|n[uú]mero de participantes|\bpax\b|\badults?\b|\badultos?\b)/i;

/** Buzones que no escriben preguntas: lo que mandan es una notificación. */
const AUTOMATED_SENDER_RE =
  /(no-?reply|noreply|do-?not-?reply|notifications?@|mailer|automated|bookings?@|reservas?@)/i;

/** Palabras de reserva, útiles solo cuando quien escribe es un robot. */
const BOOKING_WORD_RE = /(booking|reserva|reservation|cancel)/i;

/**
 * Un email que ningún parser reconoce: ¿reserva o mensaje?
 *
 * La regla de oro es que **una reserva no se puede perder**: ante la duda se
 * marca como reserva, que la deja visible como "no se pudo leer" para que
 * alguien la mire. Lo que sí se puede ignorar con tranquilidad es a un cliente
 * escribiendo: antes bastaba con que el asunto dijera "reserva" para tratarlo
 * como reserva fallida, así que "Consulta sobre mi reserva" acababa en la lista
 * de errores todos los días.
 */
export function classifyUnknown(email: EmailInput): UnknownKind {
  if (REPLY_RE.test(email.subject ?? "")) return "message";

  const subject = email.subject ?? "";
  const body = fullText(bestBody(email.bodyHtml, email.bodyText));
  const todo = `${subject}\n${body}`;

  // Un localizador en el asunto es la firma de una confirmación automática.
  if (REF_TOKEN_RE.test(subject)) return "booking";
  // En el cuerpo, el localizador solo cuenta si viene con sus etiquetas: así no
  // se cuela cualquier código de seguimiento del pie de página.
  if (BOOKING_LABEL_RE.test(todo) && REF_TOKEN_RE.test(body)) return "booking";
  // Un robot no pregunta: si habla de reservas, es una.
  if (AUTOMATED_SENDER_RE.test(email.fromAddress ?? "") && BOOKING_WORD_RE.test(todo)) {
    return "booking";
  }
  return "message";
}
