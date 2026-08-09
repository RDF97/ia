import {
  accountTotals,
  balances,
  equalSplits,
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
