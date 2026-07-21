import { dueInfo, groupTasks, nextDue, nextDueAfter, sortPending, taskReminderPlan } from "./taskLogic";

describe("nextDue", () => {
  it("avanza según la periodicidad", () => {
    expect(nextDue("2026-07-15T09:00:00.000Z", "none")).toBeNull();
    expect(new Date(nextDue("2026-07-15T09:00:00.000Z", "daily")!).getUTCDate()).toBe(16);
    expect(new Date(nextDue("2026-07-15T09:00:00.000Z", "weekly")!).getUTCDate()).toBe(22);
    expect(new Date(nextDue("2026-07-15T09:00:00.000Z", "monthly")!).getUTCMonth()).toBe(7); // agosto
  });

  it("weekdays salta fin de semana (viernes → lunes)", () => {
    // 2026-07-17 es viernes
    const next = new Date(nextDue("2026-07-17T09:00:00.000Z", "weekdays")!);
    expect(next.getDay()).toBe(1); // lunes
    expect(next.getUTCDate()).toBe(20);
  });
});

describe("nextDueAfter", () => {
  it("adelanta hasta la primera ocurrencia futura", () => {
    const now = new Date("2026-07-15T12:00:00.000Z");
    // tarea diaria cuya fecha original es de hace días → siguiente futura
    const next = nextDueAfter("2026-07-10T09:00:00.000Z", "daily", now);
    expect(new Date(next!).getTime()).toBeGreaterThan(now.getTime());
    // debe ser el 16 a las 09:00 (primera > now)
    expect(new Date(next!).getUTCDate()).toBe(16);
  });
});

describe("dueInfo", () => {
  const now = new Date("2026-07-15T12:00:00.000Z");
  it("etiqueta Hoy/Mañana y detecta vencidas", () => {
    expect(dueInfo("2026-07-15T18:00:00.000Z", now).label.startsWith("Hoy")).toBe(true);
    expect(dueInfo("2026-07-16T09:00:00.000Z", now).label.startsWith("Mañana")).toBe(true);
    expect(dueInfo("2026-07-15T08:00:00.000Z", now).overdue).toBe(true);
    expect(dueInfo("2026-07-15T18:00:00.000Z", now).overdue).toBe(false);
  });
});

describe("taskReminderPlan", () => {
  const now = new Date("2026-07-15T12:00:00.000Z");
  const base = { done: false, notify: true };
  const mk = (o: any) => ({ $id: o.id, title: o.title ?? "Tarea", ...base, ...o });

  it("incluye solo tareas con aviso, futuras, sin completar y para mí o sin asignar", () => {
    const tasks = [
      mk({ id: "a", dueAt: "2026-07-16T09:00:00.000Z", assignedToName: null }),
      mk({ id: "b", dueAt: "2026-07-16T09:00:00.000Z", assignedToName: "Rubén" }),
      mk({ id: "c", dueAt: "2026-07-16T09:00:00.000Z", assignedToName: "María" }), // otra persona
      mk({ id: "d", dueAt: "2026-07-14T09:00:00.000Z", assignedToName: null }), // pasada
      mk({ id: "e", dueAt: "2026-07-16T09:00:00.000Z", notify: false }), // sin aviso
      mk({ id: "f", dueAt: "2026-07-16T09:00:00.000Z", done: true }), // hecha
      mk({ id: "g", assignedToName: null }), // sin fecha
    ];
    const ids = taskReminderPlan(tasks, "Rubén", now).map((r) => r.id);
    expect(ids.sort()).toEqual(["a", "b"]);
  });

  it("la firma cambia con la fecha o el título", () => {
    const [r] = taskReminderPlan([mk({ id: "a", title: "Basura", dueAt: "2026-07-16T09:00:00.000Z" })], "Rubén", now);
    expect(r.sig).toBe("2026-07-16T09:00:00.000Z|Basura");
  });
});

describe("sortPending", () => {
  it("primero las que tienen fecha (más próxima antes), luego el resto por recientes", () => {
    const tasks = [
      { $id: "sinfecha1", $createdAt: "2026-07-10T00:00:00.000Z" },
      { $id: "lejana", dueAt: "2026-07-20T00:00:00.000Z", $createdAt: "2026-07-01T00:00:00.000Z" },
      { $id: "proxima", dueAt: "2026-07-16T00:00:00.000Z", $createdAt: "2026-07-01T00:00:00.000Z" },
      { $id: "sinfecha2", $createdAt: "2026-07-12T00:00:00.000Z" },
    ];
    expect(sortPending(tasks).map((x) => x.$id)).toEqual(["proxima", "lejana", "sinfecha2", "sinfecha1"]);
  });
});

describe("groupTasks", () => {
  const now = new Date("2026-07-14T12:00:00.000Z"); // martes 14
  const T = (over: Partial<{ $id: string; done: boolean; dueAt: string | null }>) => ({
    $id: over.$id ?? "x",
    done: over.done ?? false,
    dueAt: over.dueAt ?? null,
    $createdAt: "2026-07-01T00:00:00.000Z",
  });
  const tasks = [
    T({ $id: "atras", dueAt: "2026-07-12T09:00:00.000Z" }),
    T({ $id: "hoy", dueAt: "2026-07-14T20:00:00.000Z" }),
    T({ $id: "manana", dueAt: "2026-07-15T09:00:00.000Z" }),
    T({ $id: "semana", dueAt: "2026-07-18T09:00:00.000Z" }),
    T({ $id: "lejos", dueAt: "2026-08-30T09:00:00.000Z" }),
    T({ $id: "sinfecha" }),
    T({ $id: "hecha", done: true, dueAt: "2026-07-13T09:00:00.000Z" }),
  ];

  it("filtro 'today' → solo atrasadas y hoy", () => {
    const g = groupTasks(tasks, "today", now);
    expect(g.map((x) => x.key)).toEqual(["overdue", "today"]);
    expect(g[1].tasks.map((t) => t.$id)).toEqual(["hoy"]);
  });

  it("filtro 'week' → hasta esta semana, sin 'más adelante' ni completadas", () => {
    const g = groupTasks(tasks, "week", now);
    expect(g.map((x) => x.key)).toEqual(["overdue", "today", "tomorrow", "week"]);
  });

  it("filtro 'all' → todos los grupos + Completadas al final", () => {
    const g = groupTasks(tasks, "all", now);
    expect(g.map((x) => x.key)).toEqual(["overdue", "today", "tomorrow", "week", "later", "noDate", "done"]);
    expect(g[g.length - 1].tasks.map((t) => t.$id)).toEqual(["hecha"]);
  });
});
