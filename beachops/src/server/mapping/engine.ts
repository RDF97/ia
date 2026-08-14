import { MappingRule, TimeSlot } from "../db/schema";
import { ParsedBooking } from "../parsers/types";

export type MappingTarget = {
  productId: string;
  locationId: string;
  timeSlotId?: string;
};

/** Minutos desde medianoche de un "HH:MM[:SS]". */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function ruleMatches(rule: MappingRule, parsed: ParsedBooking, subject: string | null): boolean {
  if (rule.source && rule.source !== parsed.source) return false;
  const haystack =
    rule.matchField === "subject"
      ? (subject ?? "")
      : `${parsed.rawProductName} ${parsed.externalProductCode ?? ""}`;
  const value = rule.matchValue;
  let textMatch = false;
  switch (rule.matchType) {
    case "contains":
      textMatch = haystack.toLowerCase().includes(value.toLowerCase());
      break;
    case "equals":
      textMatch = haystack.trim().toLowerCase() === value.trim().toLowerCase();
      break;
    case "regex":
      try {
        textMatch = new RegExp(value, "i").test(haystack);
      } catch {
        textMatch = false;
      }
      break;
  }
  if (!textMatch) return false;
  if (rule.timeMatch && parsed.activityTime) {
    return timeToMinutes(rule.timeMatch) === timeToMinutes(parsed.activityTime);
  }
  return true;
}

/** Primera regla (por prioridad ascendente) que casa con la reserva parseada. */
export function applyMappingRules(
  rules: MappingRule[],
  parsed: ParsedBooking,
  subject: string | null,
): MappingTarget | null {
  const sorted = [...rules]
    .filter((r) => r.active)
    .sort((a, b) => a.priority - b.priority);
  for (const rule of sorted) {
    if (ruleMatches(rule, parsed, subject)) {
      return {
        productId: rule.targetProductId,
        locationId: rule.targetLocationId,
        timeSlotId: rule.targetTimeSlotId ?? undefined,
      };
    }
  }
  return null;
}

/**
 * La franja de la plantilla que sale EXACTAMENTE a esa hora, en esa playa y
 * (si la franja lo especifica) para ese producto.
 *
 * La hora la manda el email, siempre. Antes había una tolerancia de 30 min para
 * arrimar la reserva a la franja más cercana, y eso movía gente de sitio: una
 * reserva de Es Pontàs de las 10:00 acababa listada a las 10:30, que es la hora
 * de la plantilla. Si no hay franja a esa hora exacta se crea una salida a la
 * hora del email (ver `ensureAdHocDeparture`); las franjas solo aportan el cupo,
 * nunca cambian la hora.
 */
export function resolveTimeSlot(
  slots: TimeSlot[],
  locationId: string,
  productId: string,
  activityTime: string | undefined,
): TimeSlot | null {
  if (!activityTime) return null;
  const target = timeToMinutes(activityTime);
  return (
    slots
      .filter((s) => s.active && s.locationId === locationId)
      .filter((s) => !s.productId || s.productId === productId)
      .find((s) => timeToMinutes(s.startTime) === target) ?? null
  );
}
