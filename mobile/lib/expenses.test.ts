import {
  accountTotals,
  balanceDetail,
  balances,
  equalSplits,
  expenseInvolves,
  expenseOwner,
  individualByPerson,
  monthlyTotal,
  parseExpenseItems,
  parseSplits,
  stringifyExpenseItems,
  type Expense,
} from "./expenses";

// Helper para construir gastos mínimos (solo los campos que usa la lógica).
function exp(partial: Partial<Expense>): Expense {
  return {
    $id: Math.random().toString(36),
    $createdAt: new Date().toISOString(),
    $updatedAt: new Date().toISOString(),
    $permissions: [],
    $collectionId: "expenses",
    $databaseId: "homie",
    amount: 0,
    concept: "x",
    paidByName: "A",
    shared: true,
    hogarId: "h",
    ...partial,
  } as Expense;
}

describe("expenses · cálculos", () => {
  test("monthlyTotal solo suma los gastos del mes actual", () => {
    const list = [
      exp({ amount: 10 }),
      exp({ amount: 5 }),
      exp({ amount: 999, $createdAt: "2000-01-01T00:00:00.000Z" }),
    ];
    expect(monthlyTotal(list)).toBeCloseTo(15, 5);
  });

  test("balances divide los gastos compartidos a partes iguales", () => {
    const list = [
      exp({ amount: 100, paidByName: "A", shared: true }),
      exp({ amount: 40, paidByName: "B", shared: true }),
    ];
    // total compartido 140, 2 miembros → parte 70
    const res = balances(list, 2);
    const a = res.find((r) => r.name === "A")!;
    const b = res.find((r) => r.name === "B")!;
    expect(a.net).toBeCloseTo(30, 5); // pagó 100, le toca 70 → +30
    expect(b.net).toBeCloseTo(-30, 5); // pagó 40, le toca 70 → -30
  });

  test("balances ignora los gastos NO compartidos", () => {
    const list = [
      exp({ amount: 50, paidByName: "A", shared: false }),
      exp({ amount: 80, paidByName: "A", shared: true }),
    ];
    const res = balances(list, 2);
    // solo cuenta el de 80 → parte 40 → A +40
    expect(res.find((r) => r.name === "A")!.net).toBeCloseTo(40, 5);
  });

  test("balances: la cuenta conjunta NO genera deudas aunque sea compartido", () => {
    const list = [
      exp({ amount: 200, paidByName: "A", shared: true, account: "joint" }), // común: no reparte
      exp({ amount: 80, paidByName: "A", shared: true, account: "individual" }), // sí reparte
    ];
    const res = balances(list, 2);
    // solo el de 80 individual → parte 40 → A +40
    expect(res.find((r) => r.name === "A")!.net).toBeCloseTo(40, 5);
  });

  test("balances trata los gastos sin cuenta como individuales (compat)", () => {
    const list = [exp({ amount: 100, paidByName: "A", shared: true })];
    expect(balances(list, 2).find((r) => r.name === "A")!.net).toBeCloseTo(50, 5);
  });

  test("una liquidación completa salda la deuda (ambos a 0)", () => {
    const list = [
      exp({ amount: 100, paidByName: "A", shared: true }),
      exp({ amount: 40, paidByName: "B", shared: true }),
    ];
    // A +30, B -30 → B paga 30 a A → ambos saldados (no aparecen).
    const res = balances(list, 2, [{ fromName: "B", toName: "A", amount: 30 }]);
    expect(res).toEqual([]);
  });

  test("una liquidación parcial reduce la deuda", () => {
    const list = [
      exp({ amount: 100, paidByName: "A", shared: true }),
      exp({ amount: 40, paidByName: "B", shared: true }),
    ];
    const res = balances(list, 2, [{ fromName: "B", toName: "A", amount: 10 }]);
    expect(res.find((r) => r.name === "A")!.net).toBeCloseTo(20, 5);
    expect(res.find((r) => r.name === "B")!.net).toBeCloseTo(-20, 5);
  });

  test("accountTotals separa conjunta e individual del mes", () => {
    const now = new Date("2026-07-15T12:00:00.000Z");
    const thisMonth = "2026-07-10T09:00:00.000Z";
    const list = [
      exp({ amount: 200, account: "joint", $createdAt: thisMonth }),
      exp({ amount: 50, account: "individual", $createdAt: thisMonth }),
      exp({ amount: 30, $createdAt: thisMonth }), // sin cuenta → individual
      exp({ amount: 999, account: "joint", $createdAt: "2026-06-01T09:00:00.000Z" }), // otro mes
    ];
    expect(accountTotals(list, now)).toEqual({ joint: 200, individual: 80 });
  });
});

describe("parseExpenseItems", () => {
  test("lee los artículos guardados", () => {
    const raw = JSON.stringify([
      { description: "Leche", qty: 2, unitPrice: 1.15, total: 2.3 },
      { description: "Pan", qty: null, unitPrice: null, total: 1.2 },
    ]);
    const items = parseExpenseItems(raw);
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({ description: "Leche", qty: 2, unitPrice: 1.15, total: 2.3 });
    expect(items[1].qty).toBeNull();
  });

  test("nunca lanza: JSON inválido, vacío o formato raro → []", () => {
    expect(parseExpenseItems(null)).toEqual([]);
    expect(parseExpenseItems("")).toEqual([]);
    expect(parseExpenseItems("{no es json")).toEqual([]);
    expect(parseExpenseItems('{"a":1}')).toEqual([]);
    expect(parseExpenseItems('[{"description":""}]')).toEqual([]);
  });

  test("stringify devuelve null si no hay artículos", () => {
    expect(stringifyExpenseItems([])).toBeNull();
  });
});

describe("balances · con miembros que no han pagado", () => {
  test("quien no ha pagado nada también aparece debiendo su parte", () => {
    const list = [exp({ amount: 100, paidByName: "A", shared: true })];
    // Antes solo salía "A": "B" no aparecía porque nunca pagó.
    const res = balances(list, 2, [], ["A", "B"]);
    expect(res.find((r) => r.name === "A")!.net).toBeCloseTo(50, 5);
    expect(res.find((r) => r.name === "B")!.net).toBeCloseTo(-50, 5);
  });

  test("sin gastos compartidos no aparece nadie", () => {
    expect(balances([], 2, [], ["A", "B"])).toEqual([]);
  });
});

describe("reparto por porcentajes", () => {
  test("parseSplits descarta repartos que no suman 100", () => {
    const ok = JSON.stringify([{ name: "A", pct: 20 }, { name: "B", pct: 80 }]);
    expect(parseSplits(ok)).toEqual([{ name: "A", pct: 20 }, { name: "B", pct: 80 }]);
    // 20+70 = 90 → se ignora y se repartirá a partes iguales
    expect(parseSplits(JSON.stringify([{ name: "A", pct: 20 }, { name: "B", pct: 70 }]))).toEqual([]);
    expect(parseSplits("no es json")).toEqual([]);
    expect(parseSplits(null)).toEqual([]);
  });

  test("equalSplits reparte a partes iguales y suma exactamente 100", () => {
    expect(equalSplits(["A", "B"])).toEqual([{ name: "A", pct: 50 }, { name: "B", pct: 50 }]);
    const three = equalSplits(["A", "B", "C"]);
    expect(three.reduce((s, x) => s + x.pct, 0)).toBeCloseTo(100, 5);
  });

  test("un gasto 20/80 reparte según esos porcentajes", () => {
    const list = [
      exp({
        amount: 100,
        paidByName: "A",
        shared: true,
        splits: JSON.stringify([{ name: "A", pct: 20 }, { name: "B", pct: 80 }]),
      }),
    ];
    const res = balances(list, 2, [], ["A", "B"]);
    // A puso 100 y le tocaba 20 → +80. B no puso nada y le tocaba 80 → -80.
    expect(res.find((r) => r.name === "A")!.net).toBeCloseTo(80, 5);
    expect(res.find((r) => r.name === "B")!.net).toBeCloseTo(-80, 5);
  });

  test("se pueden mezclar gastos con y sin reparto", () => {
    const list = [
      exp({ amount: 100, paidByName: "A", shared: true, splits: JSON.stringify([{ name: "A", pct: 20 }, { name: "B", pct: 80 }]) }),
      exp({ amount: 50, paidByName: "B", shared: true }), // a partes iguales: 25 y 25
    ];
    const res = balances(list, 2, [], ["A", "B"]);
    // A: pagó 100, debe 20+25=45 → +55 · B: pagó 50, debe 80+25=105 → -55
    expect(res.find((r) => r.name === "A")!.net).toBeCloseTo(55, 5);
    expect(res.find((r) => r.name === "B")!.net).toBeCloseTo(-55, 5);
  });

  test("una liquidación salda también un gasto con porcentajes", () => {
    const list = [
      exp({ amount: 100, paidByName: "A", shared: true, splits: JSON.stringify([{ name: "A", pct: 20 }, { name: "B", pct: 80 }]) }),
    ];
    const res = balances(list, 2, [{ fromName: "B", toName: "A", amount: 80 }], ["A", "B"]);
    expect(res).toEqual([]);
  });
});

describe("gasto individual de otra persona (paga uno, es de otro)", () => {
  test("si lo paga otro, el titular se lo debe entero", () => {
    const list = [
      // Clara paga 60 € del gimnasio de Rubén: no es compartido, es de Rubén.
      exp({ amount: 60, paidByName: "Clara", shared: false, account: "individual", forName: "Rubén" }),
    ];
    const res = balances(list, 2, [], ["Clara", "Rubén"]);
    expect(res.find((r) => r.name === "Clara")!.net).toBeCloseTo(60, 5);
    expect(res.find((r) => r.name === "Rubén")!.net).toBeCloseTo(-60, 5);
  });

  test("si el titular es quien pagó, no hay deuda (compat con lo de antes)", () => {
    const list = [exp({ amount: 60, paidByName: "Clara", shared: false, account: "individual", forName: "Clara" })];
    expect(balances(list, 2, [], ["Clara", "Rubén"])) .toEqual([]);
  });

  test("sin titular se comporta como siempre: es de quien lo pagó", () => {
    const list = [exp({ amount: 60, paidByName: "Clara", shared: false, account: "individual" })];
    expect(balances(list, 2, [], ["Clara", "Rubén"])).toEqual([]);
  });

  test("liquidar salda un gasto personal pagado por otro", () => {
    const list = [exp({ amount: 60, paidByName: "Clara", shared: false, account: "individual", forName: "Rubén" })];
    const res = balances(list, 2, [{ fromName: "Rubén", toName: "Clara", amount: 60 }], ["Clara", "Rubén"]);
    expect(res).toEqual([]);
  });

  test("expenseOwner: el titular manda; si no hay, quien pagó", () => {
    expect(expenseOwner({ forName: "Rubén", paidByName: "Clara" })).toBe("Rubén");
    expect(expenseOwner({ forName: null, paidByName: "Clara" })).toBe("Clara");
    expect(expenseOwner({ forName: "  ", paidByName: "Clara" })).toBe("Clara");
  });
});

describe("individualByPerson · gasto individual separado por usuario", () => {
  const members = ["Clara", "Rubén"];

  test("cada gasto personal va a su titular, no a quien lo pagó", () => {
    const list = [
      exp({ amount: 60, paidByName: "Clara", shared: false, account: "individual", forName: "Rubén" }),
      exp({ amount: 40, paidByName: "Clara", shared: false, account: "individual" }),
    ];
    expect(individualByPerson(list, members)).toEqual({ Clara: 40, "Rubén": 60 });
  });

  test("los compartidos se reparten a partes iguales", () => {
    const list = [exp({ amount: 100, paidByName: "Clara", shared: true, account: "individual" })];
    expect(individualByPerson(list, members)).toEqual({ Clara: 50, "Rubén": 50 });
  });

  test("los compartidos con porcentaje se reparten según el porcentaje", () => {
    const list = [
      exp({
        amount: 100,
        paidByName: "Clara",
        shared: true,
        account: "individual",
        splits: JSON.stringify([{ name: "Clara", pct: 20 }, { name: "Rubén", pct: 80 }]),
      }),
    ];
    expect(individualByPerson(list, members)).toEqual({ Clara: 20, "Rubén": 80 });
  });

  test("la cuenta conjunta no es de nadie en particular", () => {
    const list = [exp({ amount: 200, paidByName: "Clara", shared: true, account: "joint" })];
    expect(individualByPerson(list, members)).toEqual({ Clara: 0, "Rubén": 0 });
  });
});

describe("balanceDetail · de dónde sale la deuda", () => {
  test("el desglose suma exactamente lo mismo que el balance", () => {
    const list = [
      exp({ amount: 100, paidByName: "Clara", shared: true, account: "individual" }),
      exp({ amount: 40, paidByName: "Rubén", shared: true, account: "individual" }),
      exp({ amount: 60, paidByName: "Clara", shared: false, account: "individual", forName: "Rubén" }),
    ];
    const members = ["Clara", "Rubén"];
    for (const who of members) {
      const d = balanceDetail(list, who, 2, [], members);
      const net = balances(list, 2, [], members).find((b) => b.name === who)!.net;
      expect(d.net).toBeCloseTo(net, 5);
    }
  });

  test("cada línea dice lo que puso y lo que le tocaba", () => {
    const list = [exp({ amount: 100, concept: "Cena", paidByName: "Clara", shared: true, account: "individual" })];
    const d = balanceDetail(list, "Clara", 2, [], ["Clara", "Rubén"]);
    expect(d.lines).toHaveLength(1);
    expect(d.lines[0]).toMatchObject({ concept: "Cena", paid: 100, owed: 50, delta: 50 });
  });

  test("las liquidaciones salen en el desglose (si no, no cuadraría)", () => {
    const list = [exp({ amount: 100, paidByName: "Clara", shared: true, account: "individual" })];
    const d = balanceDetail(list, "Rubén", 2, [{ fromName: "Rubén", toName: "Clara", amount: 50 }], ["Clara", "Rubén"]);
    expect(d.lines.some((l) => l.kind === "settlement")).toBe(true);
    expect(d.net).toBeCloseTo(0, 5);
  });

  test("la cuenta conjunta no aparece: no genera deuda", () => {
    const list = [exp({ amount: 200, paidByName: "Clara", shared: true, account: "joint" })];
    expect(balanceDetail(list, "Rubén", 2, [], ["Clara", "Rubén"]).lines).toEqual([]);
  });

  test("no se listan gastos que no le tocan a esa persona", () => {
    const list = [exp({ amount: 60, paidByName: "Clara", shared: false, account: "individual", forName: "Clara" })];
    expect(balanceDetail(list, "Rubén", 2, [], ["Clara", "Rubén"]).lines).toEqual([]);
  });
});

describe("nadie sin nombre debe dinero", () => {
  test("un miembro sin nombre no entra en el reparto ni aparece debiendo", () => {
    const list = [exp({ amount: 100, paidByName: "Clara", shared: true, account: "individual" })];
    // `payingMembers` ya filtra a los que no tienen nombre: aquí solo llegan los reales.
    const res = balances(list, 2, [], ["Clara"]);
    expect(res.map((r) => r.name)).toEqual(["Clara"]);
    expect(res.every((r) => r.name.trim().length > 0)).toBe(true);
  });

  test("un nombre en blanco en la lista de miembros se ignora", () => {
    const list = [exp({ amount: 100, paidByName: "Clara", shared: true, account: "individual" })];
    const res = balances(list, 2, [], ["Clara", "", "   "]);
    expect(res.map((r) => r.name)).toEqual(["Clara"]);
  });
});

describe("expenseInvolves · filtrar movimientos por usuario", () => {
  test("le toca a quien lo pagó", () => {
    expect(expenseInvolves(exp({ paidByName: "Clara", shared: false, account: "individual" }), "Clara")).toBe(true);
  });

  test("le toca a su titular aunque lo pagara otro", () => {
    const e = exp({ paidByName: "Clara", shared: false, account: "individual", forName: "Rubén" });
    expect(expenseInvolves(e, "Rubén")).toBe(true);
    expect(expenseInvolves(e, "Clara")).toBe(true); // ella puso el dinero
  });

  test("un gasto personal de otro no me toca", () => {
    const e = exp({ paidByName: "Clara", shared: false, account: "individual", forName: "Clara" });
    expect(expenseInvolves(e, "Rubén")).toBe(false);
  });

  test("un compartido sin porcentajes es de todo el hogar", () => {
    expect(expenseInvolves(exp({ paidByName: "Clara", shared: true, account: "individual" }), "Rubén")).toBe(true);
  });

  test("con porcentajes, solo a quien sale en el reparto", () => {
    const e = exp({
      paidByName: "Clara",
      shared: true,
      account: "individual",
      splits: JSON.stringify([{ name: "Clara", pct: 100 }]),
    });
    expect(expenseInvolves(e, "Rubén")).toBe(false);
    expect(expenseInvolves(e, "Clara")).toBe(true);
  });

  test("sin filtro entra todo", () => {
    expect(expenseInvolves(exp({ paidByName: "Clara", shared: false, account: "individual" }), "")).toBe(true);
  });
});
