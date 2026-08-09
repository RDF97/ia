import { dayIndexLabel, daysWithEvents, eventCoversDay, eventDays, eventsOfDay, ymd, type Event } from "./events";

const ev = (partial: Partial<Event>): Event =>
  ({
    $id: Math.random().toString(36),
    $createdAt: "2026-08-01T00:00:00.000Z",
    $updatedAt: "2026-08-01T00:00:00.000Z",
    $permissions: [],
    $collectionId: "events",
    $databaseId: "homie",
    title: "x",
    startAt: "2026-08-10T12:00:00.000Z",
    ownerName: "A",
    hogarId: "h",
    ...partial,
  }) as Event;

// Fechas locales para que el test no dependa de la zona horaria.
const local = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).toISOString();

describe("eventos de varios días", () => {
  test("un evento de un día ocupa un solo día", () => {
    expect(eventDays({ startAt: local(2026, 8, 10), endAt: null })).toEqual(["2026-08-10"]);
  });

  test("una semana de vacaciones ocupa los 7 días", () => {
    const days = eventDays({ startAt: local(2026, 8, 10), endAt: local(2026, 8, 16, 23) });
    expect(days).toHaveLength(7);
    expect(days[0]).toBe("2026-08-10");
    expect(days[6]).toBe("2026-08-16");
  });

  test("cubre también los días de en medio, no solo el primero", () => {
    const e = ev({ startAt: local(2026, 8, 10), endAt: local(2026, 8, 16, 23) });
    expect(eventCoversDay(e, new Date(2026, 7, 13))).toBe(true);
    expect(eventCoversDay(e, new Date(2026, 7, 17))).toBe(false);
  });

  test("un fin anterior al inicio se ignora en vez de romper", () => {
    expect(eventDays({ startAt: local(2026, 8, 10), endAt: local(2026, 8, 1) })).toEqual(["2026-08-10"]);
  });

  test("una fecha de fin absurda no cuelga la app", () => {
    const days = eventDays({ startAt: local(2026, 8, 10), endAt: local(2200, 1, 1) });
    expect(days.length).toBeLessThanOrEqual(401);
  });

  test("cruza el cambio de mes", () => {
    const days = eventDays({ startAt: local(2026, 8, 30), endAt: local(2026, 9, 2, 23) });
    expect(days).toEqual(["2026-08-30", "2026-08-31", "2026-09-01", "2026-09-02"]);
  });

  test("el calendario marca todos los días del evento", () => {
    const marked = daysWithEvents([ev({ startAt: local(2026, 8, 10), endAt: local(2026, 8, 12, 23) })]);
    expect(marked.has("2026-08-11")).toBe(true);
    expect(marked.has("2026-08-13")).toBe(false);
  });

  test("la agenda de un día intermedio muestra el evento", () => {
    const list = [ev({ title: "Mallorca", startAt: local(2026, 8, 10), endAt: local(2026, 8, 16, 23) })];
    expect(eventsOfDay(list, new Date(2026, 7, 14)).map((e) => e.title)).toEqual(["Mallorca"]);
  });

  test("etiqueta 'Día N de M' solo en los de varios días", () => {
    const largo = ev({ startAt: local(2026, 8, 10), endAt: local(2026, 8, 16, 23) });
    expect(dayIndexLabel(largo, new Date(2026, 7, 12))).toBe("Día 3 de 7");
    expect(dayIndexLabel(ev({ startAt: local(2026, 8, 10) }), new Date(2026, 7, 10))).toBeNull();
  });

  test("ymd usa la fecha local (no se va un día por la zona horaria)", () => {
    expect(ymd(new Date(2026, 7, 9))).toBe("2026-08-09");
  });
});
