import { dueInfo, groupTasks, hiddenNoDate, nextDue, nextDueAfter, sortPending, taskReminderPlan } from "./taskLogic";

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
    expect(r.sig).toBe("2026-07-16T09:00:00.000Z|Basura|0");
  });

  it("resta la antelación: a las 09:00 con 1 h antes, el aviso es a las 08:00", () => {
    const [r] = taskReminderPlan(
      [mk({ id: "a", dueAt: "2026-07-16T09:00:00.000Z", notifyLead: 60 })],
      "Rubén",
      now,
    );
    expect(r.date.toISOString()).toBe("2026-07-16T08:00:00.000Z");
  });

  it("una antelación ausente, nula o fuera de la lista equivale a 'a la hora'", () => {
    for (const lead of [undefined, null, NaN, 7, -30]) {
      const [r] = taskReminderPlan([mk({ id: "a", dueAt: "2026-07-16T09:00:00.000Z", notifyLead: lead })], "Rubén", now);
      expect(r.date.toISOString()).toBe("2026-07-16T09:00:00.000Z");
    }
  });

  // Sin esto, cambiar la antelación no reprogramaría nada: `syncTaskReminders`
  // solo cancela y vuelve a programar cuando la firma cambia.
  it("la firma cambia si SOLO cambia la antelación", () => {
    // Fecha a dos días vista: con "1 día antes" el aviso sigue estando en el
    // futuro, que si no la tarea se descarta y no habría firma que comparar.
    const task = { id: "a", title: "Basura", dueAt: "2026-07-17T09:00:00.000Z" };
    const [a] = taskReminderPlan([mk({ ...task, notifyLead: 0 })], "Rubén", now);
    const [b] = taskReminderPlan([mk({ ...task, notifyLead: 1440 })], "Rubén", now);
    expect(a.sig).not.toBe(b.sig);
  });

  it("descarta la tarea cuyo AVISO ya pasó, aunque la fecha sea futura", () => {
    // Falta media hora para la tarea, pero el aviso era una hora antes: ya no
    // llega a tiempo. Si se colara, `scheduleAt` lo rechazaría y se reintentaría
    // en cada sincronización.
    const plan = taskReminderPlan(
      [mk({ id: "a", dueAt: "2026-07-15T12:30:00.000Z", notifyLead: 60 })],
      "Rubén",
      now,
    );
    expect(plan).toEqual([]);
  });

  it("con antelación, el aviso dice a qué hora toca", () => {
    const [r] = taskReminderPlan(
      [mk({ id: "a", title: "Basura", dueAt: "2026-07-17T09:00:00.000Z", notifyLead: 1440, assignedToName: null })],
      "Rubén",
      now,
    );
    expect(r.body).toContain("Basura");
    expect(r.body).toMatch(/\d{2}:\d{2}/);
  });

  it("una tarea diaria con '1 día antes' avisa: salta a la ocurrencia que llega a tiempo", () => {
    // Sin el salto no avisaría nunca: al rodar, el aviso de la ocurrencia actual
    // ya está vencido y se descartaba en cada sincronización.
    const plan = taskReminderPlan(
      [mk({ id: "a", dueAt: "2026-07-15T20:00:00.000Z", notifyLead: 1440, repeat: "daily" })],
      "Rubén",
      now,
    );
    expect(plan).toHaveLength(1);
    expect(plan[0].date.getTime()).toBeGreaterThan(now.getTime());
  });

  it("no salta más allá de la fecha límite de la repetición", () => {
    const plan = taskReminderPlan(
      [
        mk({
          id: "a",
          dueAt: "2026-07-15T20:00:00.000Z",
          notifyLead: 1440,
          repeat: "daily",
          repeatUntil: "2026-07-15T00:00:00.000Z",
        }),
      ],
      "Rubén",
      now,
    );
    expect(plan).toEqual([]);
  });

  it("una tarea que NO se repite no salta a ninguna parte", () => {
    const plan = taskReminderPlan(
      [mk({ id: "a", dueAt: "2026-07-15T12:30:00.000Z", notifyLead: 60, repeat: "none" })],
      "Rubén",
      now,
    );
    expect(plan).toEqual([]);
  });

  it("sigue filtrando por hecha, sin aviso y de otra persona aunque haya antelación", () => {
    const tasks = [
      mk({ id: "hecha", dueAt: "2026-07-16T09:00:00.000Z", notifyLead: 60, done: true }),
      mk({ id: "sinaviso", dueAt: "2026-07-16T09:00:00.000Z", notifyLead: 60, notify: false }),
      mk({ id: "deotra", dueAt: "2026-07-16T09:00:00.000Z", notifyLead: 60, assignedToName: "María" }),
      mk({ id: "buena", dueAt: "2026-07-16T09:00:00.000Z", notifyLead: 60, assignedToName: null }),
    ];
    expect(taskReminderPlan(tasks, "Rubén", now).map((r) => r.id)).toEqual(["buena"]);
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

  it("filtro 'today' → solo atrasadas y hoy; las que no tienen fecha no se cuelan", () => {
    const g = groupTasks(tasks, "today", now);
    expect(g.map((x) => x.key)).toEqual(["overdue", "today"]);
    expect(g.find((x) => x.key === "today")?.tasks.map((t) => t.$id)).toEqual(["hoy"]);
  });

  it("filtro 'week' → hasta esta semana, sin 'más adelante' ni completadas", () => {
    const g = groupTasks(tasks, "week", now);
    expect(g.map((x) => x.key)).toEqual(["overdue", "today", "tomorrow", "week"]);
  });

  // Guardián de la queja original: una tarea añadida deprisa nace sin fecha, y
  // tiene que estar donde se vea a la primera, no enterrada al final.
  it("una tarea sin fecha aparece la primera de todo en 'Todas'", () => {
    const g = groupTasks(tasks, "all", now);
    expect(g[0].key).toBe("noDate");
    expect(g[0].tasks.map((t) => t.$id)).toEqual(["sinfecha"]);
  });

  it("en 'Todas' sí se separan las que no tienen fecha", () => {
    const g = groupTasks(tasks, "all", now);
    expect(g.find((x) => x.key === "noDate")?.tasks.map((t) => t.$id)).toEqual(["sinfecha"]);
    expect(g.find((x) => x.key === "today")?.tasks.map((t) => t.$id)).toEqual(["hoy"]);
  });

  it("filtro 'all' → 'Sin fecha' primero y Completadas al final", () => {
    const g = groupTasks(tasks, "all", now);
    expect(g.map((x) => x.key)).toEqual(["noDate", "overdue", "today", "tomorrow", "week", "later", "done"]);
    expect(g.find((x) => x.key === "done")?.tasks.map((t) => t.$id)).toEqual(["hecha"]);
  });
});

describe("hiddenNoDate · las que el filtro no enseña", () => {
  const T = (o: Partial<{ $id: string; done: boolean; dueAt: string | null }>) => ({
    $id: o.$id ?? "x",
    done: o.done ?? false,
    dueAt: o.dueAt ?? null,
  });
  const tasks = [
    T({ $id: "sin1" }),
    T({ $id: "sin2" }),
    T({ $id: "conFecha", dueAt: "2026-07-14T09:00:00.000Z" }),
    T({ $id: "hechaSinFecha", done: true }),
  ];

  it("cuenta las pendientes sin fecha en 'Hoy' y en 'Semana'", () => {
    expect(hiddenNoDate(tasks, "today")).toBe(2);
    expect(hiddenNoDate(tasks, "week")).toBe(2);
  });

  it("en 'Todas' no cuenta ninguna, porque ahí se ven", () => {
    expect(hiddenNoDate(tasks, "all")).toBe(0);
  });

  it("no cuenta las completadas", () => {
    expect(hiddenNoDate([T({ done: true })], "today")).toBe(0);
  });
});

describe("repetición con fecha límite", () => {
  const now = new Date("2026-07-14T12:00:00.000Z");

  test("sin límite sigue repitiéndose", () => {
    expect(nextDueAfter("2026-07-01T09:00:00.000Z", "monthly", now)).not.toBeNull();
  });

  test("si la siguiente cae después del límite, se acabó", () => {
    // El ING se repite cada mes hasta septiembre: en septiembre ya no rueda más.
    const next = nextDueAfter("2026-09-01T09:00:00.000Z", "monthly", new Date("2026-09-02T12:00:00.000Z"), "2026-09-30T00:00:00.000Z");
    expect(next).toBeNull();
  });

  test("una ocurrencia que cae justo el día del límite sí vale", () => {
    const next = nextDueAfter("2026-08-30T09:00:00.000Z", "monthly", new Date("2026-08-31T12:00:00.000Z"), "2026-09-30T00:00:00.000Z");
    expect(next).not.toBeNull();
    expect(new Date(next as string).getMonth()).toBe(8); // septiembre
  });

  test("un límite inválido no bloquea la repetición", () => {
    expect(nextDueAfter("2026-07-01T09:00:00.000Z", "monthly", now, "no es una fecha")).not.toBeNull();
  });
});
