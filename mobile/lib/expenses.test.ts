import { accountTotals, balances, monthlyTotal, type Expense } from "./expenses";

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
