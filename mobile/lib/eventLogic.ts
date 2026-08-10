import type { Event } from "./events";

/** Minutos de antelación del aviso de un evento. */
export const LEAD_OPTIONS = [
  { key: 0, label: "A la hora" },
  { key: 15, label: "15 min antes" },
  { key: 60, label: "1 h antes" },
  { key: 1440, label: "1 día antes" },
];

export interface EventReminder {
  id: string;
  date: Date;
  title: string;
  body: string;
  sig: string; // firma: cambia si hay que reprogramar
}

type EventLike = Pick<Event, "$id" | "title" | "startAt" | "place"> & { allDay?: boolean | null };

/** Hora de referencia de un evento de todo el día: las 9:00, no medianoche. */
export const ALL_DAY_HOUR = 9;

/** Avisos a programar: eventos futuros, con la antelación elegida. */
export function eventReminderPlan(
  events: EventLike[],
  leadMinutes: number,
  now: Date = new Date(),
): EventReminder[] {
  const out: EventReminder[] = [];
  for (const e of events) {
    const start = new Date(e.startAt);
    if (!isFinite(start.getTime())) continue;
    // Un evento de todo el día empieza a las 00:00, y avisar a medianoche (o el
    // día antes a medianoche) no le sirve a nadie: se toma como referencia las 9.
    const ref = e.allDay
      ? new Date(start.getFullYear(), start.getMonth(), start.getDate(), ALL_DAY_HOUR, 0, 0, 0)
      : start;
    const when = new Date(ref.getTime() - leadMinutes * 60_000);
    if (when.getTime() <= now.getTime()) continue;
    const hh = String(ref.getHours()).padStart(2, "0");
    const mm = String(ref.getMinutes()).padStart(2, "0");
    out.push({
      id: e.$id,
      date: when,
      title: `📅 ${e.title}`,
      body: `${e.allDay ? "Todo el día" : `${hh}:${mm}`}${e.place ? ` · ${e.place}` : ""}`,
      sig: `${e.startAt}|${e.title}|${leadMinutes}|${e.allDay ? 1 : 0}`,
    });
  }
  return out;
}

// --- Exportar a Google Calendar ---

const stamp = (d: Date): string =>
  `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}` +
  `T${String(d.getUTCHours()).padStart(2, "0")}${String(d.getUTCMinutes()).padStart(2, "0")}00Z`;

/**
 * URL de "añadir a Google Calendar" con el evento precargado. Abre la app de
 * Google Calendar si está instalada, si no el navegador. No necesita cuenta
 * conectada ni permisos: es el flujo estándar de Google.
 */
export function googleCalendarUrl(
  e: Pick<Event, "title" | "startAt" | "place"> & { endAt?: string | null },
  durationMinutes = 60,
): string {
  const start = new Date(e.startAt);
  const declared = e.endAt ? new Date(e.endAt) : null;
  // Respetamos el fin real (vacaciones de una semana), no una hora fija.
  const end =
    declared && isFinite(declared.getTime()) && declared.getTime() > start.getTime()
      ? declared
      : new Date(start.getTime() + durationMinutes * 60_000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${stamp(start)}/${stamp(end)}`,
  });
  if (e.place) params.set("location", e.place);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
