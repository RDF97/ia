import { budgetStatus, budgetTotals } from "./categories";

const cat = (over: Partial<{ $id: string; name: string; color: string; icon: string; budget: number }> = {}) => ({
  $id: over.$id ?? "c1",
  name: over.name ?? "Alimentación",
  color: over.color ?? "#34C759",
  icon: over.icon ?? "cart",
  budget: over.budget ?? 0,
});

const exp = (amount: number, category: string | null, iso: string) =>
  ({ amount, category, $createdAt: iso } as any);

const NOW = new Date("2026-07-15T12:00:00.000Z");
const thisMonth = "2026-07-10T09:00:00.000Z";
const lastMonth = "2026-06-20T09:00:00.000Z";

describe("budgetStatus", () => {
  it("suma solo los gastos del mes actual por categoría (case-insensitive)", () => {
    const cats = [cat({ name: "Alimentación", budget: 200 })];
    const expenses = [
      exp(50, "Alimentación", thisMonth),
      exp(30, "alimentación", thisMonth), // misma categoría, otra caja
      exp(999, "Alimentación", lastMonth), // mes anterior: no cuenta
      exp(40, "Ocio", thisMonth), // otra categoría
    ];
    const [row] = budgetStatus(cats, expenses, NOW);
    expect(row.spent).toBe(80);
    expect(row.budget).toBe(200);
    expect(row.hasBudget).toBe(true);
    expect(row.pct).toBeCloseTo(0.4);
    expect(row.state).toBe("ok");
  });

  it("marca warn a partir del 80% y over al llegar al límite", () => {
    const cats = [
      cat({ $id: "a", name: "A", budget: 100 }),
      cat({ $id: "b", name: "B", budget: 100 }),
      cat({ $id: "c", name: "C", budget: 100 }),
    ];
    const expenses = [
      exp(70, "A", thisMonth),
      exp(85, "B", thisMonth),
      exp(120, "C", thisMonth),
    ];
    const rows = budgetStatus(cats, expenses, NOW);
    expect(rows.find((r) => r.$id === "a")!.state).toBe("ok");
    expect(rows.find((r) => r.$id === "b")!.state).toBe("warn");
    expect(rows.find((r) => r.$id === "c")!.state).toBe("over");
  });

  it("sin límite: no calcula porcentaje ni estado de alerta", () => {
    const cats = [cat({ name: "Otros", budget: 0 })];
    const [row] = budgetStatus(cats, [exp(500, "Otros", thisMonth)], NOW);
    expect(row.hasBudget).toBe(false);
    expect(row.pct).toBe(0);
    expect(row.state).toBe("ok");
    expect(row.spent).toBe(500);
  });

  it("ignora gastos sin categoría", () => {
    const cats = [cat({ name: "Alimentación", budget: 100 })];
    const [row] = budgetStatus(cats, [exp(40, null, thisMonth), exp(10, "", thisMonth)], NOW);
    expect(row.spent).toBe(0);
  });
});

describe("budgetTotals", () => {
  it("suma solo categorías con límite", () => {
    const cats = [
      cat({ $id: "a", name: "A", budget: 100 }),
      cat({ $id: "b", name: "B", budget: 50 }),
      cat({ $id: "c", name: "C", budget: 0 }),
    ];
    const expenses = [exp(40, "A", thisMonth), exp(60, "B", thisMonth), exp(999, "C", thisMonth)];
    const totals = budgetTotals(budgetStatus(cats, expenses, NOW));
    expect(totals.budget).toBe(150);
    expect(totals.spent).toBe(100);
  });
});
