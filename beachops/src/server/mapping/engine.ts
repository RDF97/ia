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
 * Resuelve la franja horaria por la hora parseada (tolerancia en minutos),
 * restringida a la playa y, si la franja lo especifica, al producto.
 */
export function resolveTimeSlot(
  slots: TimeSlot[],
  locationId: string,
  productId: string,
  activityTime: string | undefined,
  // 30 min cubre marketplaces que venden a las 09:30 una salida real de 10:00;
  // gana siempre la franja más cercana.
  toleranceMin = 30,
): TimeSlot | null {
  if (!activityTime) return null;
  const target = timeToMinutes(activityTime);
  const candidates = slots
    .filter((s) => s.active && s.locationId === locationId)
    .filter((s) => !s.productId || s.productId === productId)
    .map((s) => ({ slot: s, diff: Math.abs(timeToMinutes(s.startTime) - target) }))
    .filter((c) => c.diff <= toleranceMin)
    .sort((a, b) => a.diff - b.diff);
  return candidates[0]?.slot ?? null;
}
