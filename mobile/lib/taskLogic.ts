// Lógica pura de tareas (fechas, recurrencia y recordatorios). Testeable sin backend.

export type Repeat = "none" | "daily" | "weekdays" | "weekly" | "monthly";

export const REPEAT_OPTIONS: { key: Repeat; label: string }[] = [
  { key: "none", label: "Nunca" },
  { key: "daily", label: "Cada día" },
  { key: "weekdays", label: "Entre semana" },
  { key: "weekly", label: "Cada semana" },
  { key: "monthly", label: "Cada mes" },
];

export const repeatLabel = (r: Repeat): string =>
  REPEAT_OPTIONS.find((o) => o.key === r)?.label ?? "Nunca";

const WD = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const z = (n: number) => String(n).padStart(2, "0");

/** Siguiente ocurrencia inmediata según la recurrencia (una sola vez). */
export function nextDue(fromISO: string, repeat: Repeat): string | null {
  if (repeat === "none") return null;
  const d = new Date(fromISO);
  if (repeat === "daily") d.setDate(d.getDate() + 1);
  else if (repeat === "weekly") d.setDate(d.getDate() + 7);
  else if (repeat === "monthly") d.setMonth(d.getMonth() + 1);
  else if (repeat === "weekdays") {
    do {
      d.setDate(d.getDate() + 1);
    } while (d.getDay() === 0 || d.getDay() === 6);
  }
  return d.toISOString();
}

/** Avanza la fecha hasta la primera ocurrencia estrictamente posterior a `now`. */
export function nextDueAfter(fromISO: string, repeat: Repeat, now: Date = new Date()): string | null {
  if (repeat === "none") return null;
  let iso = fromISO;
  let guard = 0;
  do {
    const nx = nextDue(iso, repeat);
    if (!nx) return null;
    iso = nx;
    guard++;
  } while (new Date(iso).getTime() <= now.getTime() && guard < 750);
  return iso;
}

export interface DueInfo {
  label: string;
  overdue: boolean;
}

/** Etiqueta amigable de la fecha ("Hoy · 09:00", "mié 16 jul · 18:30") + si está vencida. */
export function dueInfo(iso: string, now: Date = new Date()): DueInfo {
  const d = new Date(iso);
  const time = `${z(d.getHours())}:${z(d.getMinutes())}`;
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  let day: string;
  if (sameDay(d, now)) day = "Hoy";
  else if (sameDay(d, tomorrow)) day = "Mañana";
  else day = `${WD[d.getDay()]} ${d.getDate()} ${MO[d.getMonth()]}`;

  return { label: `${day} · ${time}`, overdue: d.getTime() < now.getTime() };
}

export interface TaskReminder {
  id: string;
  date: Date;
  title: string;
  body: string;
  sig: string; // firma para detectar cambios (fecha + título)
}

type TaskLike = {
  $id: string;
  title: string;
  done: boolean;
  dueAt?: string | null;
  notify?: boolean;
  assignedToName?: string | null;
};

/**
 * Recordatorios que ESTE dispositivo debe programar: tareas con aviso y fecha
 * futura, sin completar, que estén sin asignar o asignadas a mí.
 */
export function taskReminderPlan(tasks: TaskLike[], myName: string, now: Date = new Date()): TaskReminder[] {
  const out: TaskReminder[] = [];
  for (const t of tasks) {
    if (!t.notify || t.done || !t.dueAt) continue;
    const date = new Date(t.dueAt);
    if (date.getTime() <= now.getTime()) continue;
    const assignee = (t.assignedToName ?? "").trim();
    if (assignee && assignee.toLowerCase() !== myName.trim().toLowerCase()) continue;
    const body = assignee ? `Te toca: ${t.title}` : `Tarea del hogar: ${t.title}`;
    out.push({ id: t.$id, date, title: "✅ Recordatorio", body, sig: `${t.dueAt}|${t.title}` });
  }
  return out;
}

/** Orden de pendientes: primero las que tienen fecha (más próxima antes), luego el resto. */
export function sortPending<T extends { dueAt?: string | null; $createdAt: string }>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => {
    if (a.dueAt && b.dueAt) return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
    if (a.dueAt) return -1;
    if (b.dueAt) return 1;
    return new Date(b.$createdAt).getTime() - new Date(a.$createdAt).getTime();
  });
}
