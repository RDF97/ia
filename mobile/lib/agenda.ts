import { ymd, type Event } from "./events";
import type { Task } from "./tasks";

/**
 * Lo que se ve en el Calendario: eventos del hogar Y tareas con fecha.
 *
 * Las tareas NO se copian a la colección de eventos. Se mezclan al leer, y por
 * varias razones que salen del propio código:
 *
 *  · los avisos se duplicarían. `taskReminderPlan` y `eventReminderPlan` son
 *    planificadores independientes, con almacenes distintos y sin verse entre
 *    ellos; y el de eventos no filtra por `notify`, `done` ni asignación, así
 *    que un espejo haría notificar tareas sin aviso, ya hechas y de otra persona;
 *  · una tarea recurrente al completarse NO se marca hecha: mueve su fecha. Un
 *    espejo sincronizado con "si está hecha, se borra" se quedaría clavado;
 *  · borrar la tarea dejaría el espejo huérfano, porque no hay transacción.
 *
 * OJO con el tipo: `AgendaItem` NO es asignable a `Event` a propósito (le faltan
 * `ownerName`, `hogarId`…). Así el compilador impide pasar la agenda mezclada a
 * `syncEventReminders`, que es justo el error que duplicaría los avisos.
 */
export type AgendaItem =
  | {
      kind: "event";
      id: string;
      title: string;
      startAt: string;
      endAt: string | null;
      allDay: boolean;
      event: Event;
    }
  | {
      kind: "task";
      id: string;
      title: string;
      startAt: string;
      endAt: string | null;
      allDay: boolean;
      task: Task;
    };

/**
 * Mezcla eventos y tareas con fecha en una sola lista de agenda.
 *
 * Se descartan las tareas ya hechas (no hay nada que recordar) y las que traigan
 * una fecha ilegible: si se colara una, `startAt.localeCompare` y el formateo de
 * la hora darían "NaN:NaN" en pantalla.
 */
export function agendaItems(events: Event[], tasks: Task[]): AgendaItem[] {
  const out: AgendaItem[] = [];

  for (const e of events) {
    if (!isFinite(new Date(e.startAt).getTime())) continue;
    out.push({
      kind: "event",
      id: `event:${e.$id}`,
      title: e.title,
      startAt: e.startAt,
      endAt: e.endAt ?? null,
      allDay: !!e.allDay,
      event: e,
    });
  }

  for (const t of tasks) {
    if (t.done || !t.dueAt) continue;
    if (!isFinite(new Date(t.dueAt).getTime())) continue;
    out.push({
      kind: "task",
      id: `task:${t.$id}`,
      title: t.title,
      startAt: t.dueAt,
      endAt: null,
      allDay: false,
      task: t,
    });
  }

  return out;
}

/** Quién aparece bajo el título de una fila de la agenda. */
export function agendaSubtitle(item: AgendaItem): string {
  if (item.kind === "event") {
    return [item.event.ownerName, item.event.place].filter(Boolean).join(" · ");
  }
  const who = (item.task.assignedToName ?? "").trim() || "Todos";
  return `Tarea · ${who}`;
}

/** Cuántas cosas quedan por delante desde hoy (subtítulo de la pantalla). */
export function upcomingCount(items: AgendaItem[], now: Date = new Date()): number {
  const today = ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  return items.filter((i) => ymd(new Date(i.startAt)) >= today).length;
}
