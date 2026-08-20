import { agendaItems, agendaSubtitle, upcomingCount } from "./agenda";
import { dayIndexLabel, daysWithEvents, eventsOfDay, type Event } from "./events";
import type { Task } from "./tasks";

const local = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).toISOString();

const ev = (p: Partial<Event>): Event =>
  ({
    $id: "e1",
    $createdAt: local(2026, 8, 1),
    $updatedAt: local(2026, 8, 1),
    $permissions: [],
    $collectionId: "events",
    $databaseId: "homie",
    title: "Evento",
    startAt: local(2026, 8, 10),
    ownerName: "Clara",
    hogarId: "h",
    ...p,
  }) as Event;

const tk = (p: Partial<Task>): Task =>
  ({
    $id: "t1",
    $createdAt: local(2026, 8, 1),
    $updatedAt: local(2026, 8, 1),
    $permissions: [],
    $collectionId: "tasks",
    $databaseId: "homie",
    title: "Tarea",
    done: false,
    hogarId: "h",
    createdByName: "Rubén",
    ...p,
  }) as Task;

describe("agendaItems · tareas y eventos en la misma agenda", () => {
  it("una tarea con fecha entra como elemento de tipo tarea", () => {
    const [item] = agendaItems([], [tk({ dueAt: local(2026, 8, 10, 9) })]);
    expect(item.kind).toBe("task");
    expect(item.startAt).toBe(local(2026, 8, 10, 9));
    expect(item.id).toBe("task:t1");
  });

  it("una tarea sin fecha se queda fuera", () => {
    expect(agendaItems([], [tk({ dueAt: null })])).toEqual([]);
  });

  it("una fecha ilegible se descarta en vez de pintar NaN", () => {
    expect(agendaItems([], [tk({ dueAt: "no es una fecha" })])).toEqual([]);
    expect(agendaItems([ev({ startAt: "tampoco" })], [])).toEqual([]);
  });

  it("las tareas completadas no salen en el calendario", () => {
    expect(agendaItems([], [tk({ dueAt: local(2026, 8, 10), done: true })])).toEqual([]);
  });

  it("los ids no chocan aunque tarea y evento compartan $id", () => {
    const items = agendaItems([ev({ $id: "x" })], [tk({ $id: "x", dueAt: local(2026, 8, 10) })]);
    expect(new Set(items.map((i) => i.id)).size).toBe(2);
  });
});

describe("la agenda mezclada funciona con los ayudantes de fechas", () => {
  const events = [ev({ $id: "e1", startAt: local(2026, 8, 10, 18) })];
  const tasks = [tk({ $id: "t1", dueAt: local(2026, 8, 10, 9) })];
  const agenda = agendaItems(events, tasks);

  it("eventsOfDay ordena tarea y evento del mismo día por hora", () => {
    expect(eventsOfDay(agenda, new Date(2026, 7, 10)).map((i) => i.id)).toEqual(["task:t1", "event:e1"]);
  });

  it("daysWithEvents marca también los días que solo tienen tarea", () => {
    const soloTarea = agendaItems([], [tk({ dueAt: local(2026, 8, 22) })]);
    expect(daysWithEvents(soloTarea).has("2026-08-22")).toBe(true);
  });

  it("un evento de varios días conserva su 'Día N de M' en la agenda mezclada", () => {
    const largo = agendaItems([ev({ startAt: local(2026, 8, 10), endAt: local(2026, 8, 16, 23) })], tasks);
    const item = largo.find((i) => i.kind === "event")!;
    expect(dayIndexLabel(item, new Date(2026, 7, 12))).toBe("Día 3 de 7");
  });

  it("una tarea ocupa un solo día: no hereda el 'Día N de M'", () => {
    const item = agenda.find((i) => i.kind === "task")!;
    expect(dayIndexLabel(item, new Date(2026, 7, 10))).toBeNull();
  });
});

describe("agendaSubtitle", () => {
  it("el evento dice de quién es y dónde", () => {
    const [i] = agendaItems([ev({ ownerName: "Clara", place: "Casa" })], []);
    expect(agendaSubtitle(i)).toBe("Clara · Casa");
  });

  it("la tarea se marca como tarea y dice a quién le toca", () => {
    const [i] = agendaItems([], [tk({ dueAt: local(2026, 8, 10), assignedToName: "Rubén" })]);
    expect(agendaSubtitle(i)).toBe("Tarea · Rubén");
  });

  it("una tarea sin asignar es de todos", () => {
    const [i] = agendaItems([], [tk({ dueAt: local(2026, 8, 10), assignedToName: null })]);
    expect(agendaSubtitle(i)).toBe("Tarea · Todos");
  });
});

describe("upcomingCount", () => {
  const now = new Date(2026, 7, 10, 15);

  it("cuenta lo de hoy y lo de después, no lo ya pasado", () => {
    const agenda = agendaItems(
      [ev({ $id: "ayer", startAt: local(2026, 8, 9) }), ev({ $id: "manana", startAt: local(2026, 8, 11) })],
      [tk({ dueAt: local(2026, 8, 10, 9) })],
    );
    // La tarea de hoy cuenta aunque su hora ya pasara: sigue siendo de hoy.
    expect(upcomingCount(agenda, now)).toBe(2);
  });
});
