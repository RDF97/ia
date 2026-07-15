import AsyncStorage from "@react-native-async-storage/async-storage";
import { cancelScheduled, notificationsGranted, scheduleAt } from "./notifications";
import { taskReminderPlan } from "./taskLogic";
import type { Task } from "./tasks";

const KEY = "task-reminders";
type Stored = Record<string, { notifId: string; sig: string }>;

async function load(): Promise<Stored> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Stored) : {};
  } catch {
    return {};
  }
}

/**
 * Sincroniza las notificaciones locales con el estado actual de las tareas:
 * programa las que faltan, cancela las que ya no aplican y reprograma las que
 * cambiaron de fecha o título. Solo actúa si hay permiso concedido.
 */
export async function syncTaskReminders(tasks: Task[], myName: string): Promise<void> {
  if (!(await notificationsGranted())) return;
  const plan = taskReminderPlan(tasks, myName, new Date());
  const wanted = new Map(plan.map((p) => [p.id, p]));
  const stored = await load();
  const next: Stored = {};

  // Cancela lo que sobra o cambió de firma.
  for (const [id, rec] of Object.entries(stored)) {
    const w = wanted.get(id);
    if (w && w.sig === rec.sig) next[id] = rec;
    else await cancelScheduled([rec.notifId]);
  }

  // Programa lo nuevo o reprogramado.
  for (const p of plan) {
    if (next[p.id]) continue;
    const notifId = await scheduleAt(p.date, p.title, p.body);
    if (notifId) next[p.id] = { notifId, sig: p.sig };
  }

  await AsyncStorage.setItem(KEY, JSON.stringify(next));
}
