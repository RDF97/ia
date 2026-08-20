import AsyncStorage from "@react-native-async-storage/async-storage";
import { Linking } from "react-native";
import { HOGAR_CHANNEL, cancelScheduled, notificationsGranted, scheduleAt } from "./notifications";
import { eventReminderPlan, googleCalendarUrl } from "./eventLogic";
import type { Event } from "./events";

export { LEAD_OPTIONS, eventReminderPlan, googleCalendarUrl } from "./eventLogic";

const KEY = "event-reminders";
const LEAD_KEY = "event-reminders-lead";
type Stored = Record<string, { notifId: string; sig: string }>;

export async function getLeadMinutes(): Promise<number> {
  const raw = await AsyncStorage.getItem(LEAD_KEY);
  const n = raw === null ? 15 : parseInt(raw, 10);
  return Number.isFinite(n) ? n : 15;
}

export async function setLeadMinutes(min: number): Promise<void> {
  await AsyncStorage.setItem(LEAD_KEY, String(min));
}

/** Sincroniza los avisos locales con los eventos (programa, cancela y reprograma). */
export async function syncEventReminders(events: Event[], leadMinutes: number): Promise<void> {
  if (!(await notificationsGranted())) return;
  const plan = eventReminderPlan(events, leadMinutes, new Date());
  const wanted = new Map(plan.map((p) => [p.id, p]));

  let stored: Stored = {};
  try {
    const raw = await AsyncStorage.getItem(KEY);
    stored = raw ? (JSON.parse(raw) as Stored) : {};
  } catch {
    stored = {};
  }

  const next: Stored = {};
  for (const [id, rec] of Object.entries(stored)) {
    const w = wanted.get(id);
    if (w && w.sig === rec.sig) next[id] = rec;
    else await cancelScheduled([rec.notifId]);
  }
  for (const p of plan) {
    if (next[p.id]) continue;
    const notifId = await scheduleAt(p.date, p.title, p.body, HOGAR_CHANNEL);
    if (notifId) next[p.id] = { notifId, sig: p.sig };
  }
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
}

export async function addToGoogleCalendar(e: Pick<Event, "title" | "startAt" | "place">): Promise<void> {
  await Linking.openURL(googleCalendarUrl(e));
}
