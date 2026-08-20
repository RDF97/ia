import { ID, Permission, Query, Role, type Models } from "react-native-appwrite";
import { client } from "./appwrite";
import { DB_ID, EVENTS_COL, databases } from "./db";

export interface Event extends Models.Document {
  title: string;
  startAt: string; // ISO datetime
  /** Fin del evento (ISO). Ausente = termina el mismo día que empieza. */
  endAt?: string | null;
  /** Todo el día: se muestra sin hora (vacaciones, cumpleaños…). */
  allDay?: boolean | null;
  place?: string | null;
  ownerName: string;
  hogarId: string;
}

export async function listEvents(hogarId: string): Promise<Event[]> {
  const res = await databases.listDocuments<Event>(DB_ID, EVENTS_COL, [
    Query.equal("hogarId", hogarId),
    Query.orderAsc("startAt"),
    Query.limit(500),
  ]);
  return res.documents;
}

export async function addEvent(
  hogarId: string,
  data: { title: string; startAt: string; ownerName: string; place?: string; endAt?: string | null; allDay?: boolean },
): Promise<Event> {
  const perms = [
    Permission.read(Role.team(hogarId)),
    Permission.update(Role.team(hogarId)),
    Permission.delete(Role.team(hogarId)),
  ];
  const base = {
    title: data.title,
    startAt: data.startAt,
    place: data.place || null,
    ownerName: data.ownerName,
    hogarId,
  };
  // `endAt`/`allDay` puede que aún no existan en la colección (los crea
  // scripts/appwrite-setup.sh) y Appwrite rechazaría el documento entero.
  try {
    return await databases.createDocument<Event>(
      DB_ID,
      EVENTS_COL,
      ID.unique(),
      { ...base, endAt: data.endAt ?? null, allDay: data.allDay ?? false },
      perms,
    );
  } catch {
    return databases.createDocument<Event>(DB_ID, EVENTS_COL, ID.unique(), base, perms);
  }
}

export async function deleteEvent(id: string): Promise<void> {
  await databases.deleteDocument(DB_ID, EVENTS_COL, id);
}

export function subscribeEvents(onChange: () => void): () => void {
  return client.subscribe(
    `databases.${DB_ID}.collections.${EVENTS_COL}.documents`,
    () => onChange(),
  );
}

// --- Helpers de fecha ---
export const ymd = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const hhmm = (iso: string): string => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

type Span = Pick<Event, "startAt" | "endAt">;

const MAX_SPAN_DAYS = 400; // tope de seguridad ante una fecha de fin absurda

/** Todos los días (YYYY-MM-DD) que ocupa un evento, del primero al último. */
export function eventDays(e: Span): string[] {
  const start = new Date(e.startAt);
  if (!isFinite(start.getTime())) return [];
  const end = e.endAt ? new Date(e.endAt) : start;
  const last = isFinite(end.getTime()) && end.getTime() > start.getTime() ? end : start;

  const out: string[] = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const lastKey = ymd(last);
  for (let i = 0; i <= MAX_SPAN_DAYS; i++) {
    out.push(ymd(cur));
    if (ymd(cur) === lastKey) break;
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/** ¿Cae este día dentro del evento? (vale también para los de varios días) */
export const eventCoversDay = (e: Span, day: Date): boolean => eventDays(e).includes(ymd(day));

// Genéricas sobre `Span` (lo único que miran es startAt/endAt) para que valgan
// igual con eventos y con la agenda mezclada de eventos y tareas.
export function eventsOfDay<T extends Span>(events: T[], day: Date): T[] {
  return events
    .filter((e) => eventCoversDay(e, day))
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
}

export function daysWithEvents<T extends Span>(events: T[]): Set<string> {
  const out = new Set<string>();
  for (const e of events) for (const d of eventDays(e)) out.add(d);
  return out;
}

/** Etiqueta del día dentro de un evento de varios días: "Día 2 de 7". */
export function dayIndexLabel(e: Span, day: Date): string | null {
  const days = eventDays(e);
  if (days.length <= 1) return null;
  const i = days.indexOf(ymd(day));
  return i < 0 ? null : `Día ${i + 1} de ${days.length}`;
}
