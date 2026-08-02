import { eventReminderPlan, googleCalendarUrl } from "./eventLogic";

const ev = (over: Partial<{ $id: string; title: string; startAt: string; place: string | null }>) => ({
  $id: over.$id ?? "e1",
  title: over.title ?? "Cena",
  startAt: over.startAt ?? "2026-07-20T21:00:00.000Z",
  place: over.place ?? null,
});

describe("eventReminderPlan", () => {
  const now = new Date("2026-07-20T10:00:00.000Z");

  it("programa el aviso con la antelación pedida", () => {
    const [r] = eventReminderPlan([ev({ startAt: "2026-07-20T21:00:00.000Z" })], 60, now);
    expect(r.date.toISOString()).toBe("2026-07-20T20:00:00.000Z");
    expect(r.title).toContain("Cena");
  });

  it("ignora eventos cuyo aviso ya pasó", () => {
    const plan = eventReminderPlan([ev({ startAt: "2026-07-20T10:30:00.000Z" })], 60, now);
    expect(plan).toEqual([]);
  });

  it("la firma cambia si cambia la antelación (obliga a reprogramar)", () => {
    const [a] = eventReminderPlan([ev({})], 15, now);
    const [b] = eventReminderPlan([ev({})], 60, now);
    expect(a.sig).not.toBe(b.sig);
  });

  it("descarta fechas inválidas", () => {
    expect(eventReminderPlan([ev({ startAt: "no-es-fecha" })], 15, now)).toEqual([]);
  });
});

describe("googleCalendarUrl", () => {
  it("lleva título, fechas en UTC y lugar", () => {
    const url = googleCalendarUrl(
      { title: "Cena con Marta", startAt: "2026-07-20T21:00:00.000Z", place: "La Tagliatella" },
      60,
    );
    expect(url).toContain("action=TEMPLATE");
    expect(url).toContain("Cena+con+Marta");
    expect(url).toContain("dates=20260720T210000Z%2F20260720T220000Z");
    expect(url).toContain("location=La+Tagliatella");
  });

  it("sin lugar no incluye location", () => {
    const url = googleCalendarUrl({ title: "X", startAt: "2026-07-20T21:00:00.000Z", place: null });
    expect(url).not.toContain("location=");
  });
});
