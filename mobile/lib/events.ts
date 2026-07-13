import { ID, Permission, Query, Role, type Models } from "react-native-appwrite";
import { client } from "./appwrite";
import { DB_ID, EVENTS_COL, databases } from "./db";

export interface Event extends Models.Document {
  title: string;
  startAt: string; // ISO datetime
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
  data: { title: string; startAt: string; ownerName: string; place?: string },
): Promise<Event> {
  return databases.createDocument<Event>(
    DB_ID,
    EVENTS_COL,
    ID.unique(),
    {
      title: data.title,
      startAt: data.startAt,
      place: data.place || null,
      ownerName: data.ownerName,
      hogarId,
    },
    [
      Permission.read(Role.team(hogarId)),
      Permission.update(Role.team(hogarId)),
      Permission.delete(Role.team(hogarId)),
    ],
  );
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

export function eventsOfDay(events: Event[], day: Date): Event[] {
  const key = ymd(day);
  return events
    .filter((e) => ymd(new Date(e.startAt)) === key)
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
}

export function daysWithEvents(events: Event[]): Set<string> {
  return new Set(events.map((e) => ymd(new Date(e.startAt))));
}
