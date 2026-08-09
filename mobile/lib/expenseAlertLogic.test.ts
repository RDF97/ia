import { expenseAlertText, shouldAlert } from "./expenseAlertLogic";

describe("aviso de gasto nuevo", () => {
  const base = { hogarId: "h1", paidByName: "Clara" };

  test("avisa de lo que apunta otra persona del hogar", () => {
    expect(shouldAlert(base, "h1", "Rubén")).toBe(true);
  });

  test("no me avisa de lo que apunto yo", () => {
    expect(shouldAlert(base, "h1", "Clara")).toBe(false);
  });

  test("el nombre se compara sin distinguir mayúsculas ni espacios", () => {
    expect(shouldAlert({ ...base, paidByName: " clara " }, "h1", "Clara")).toBe(false);
  });

  test("nada de otros hogares", () => {
    expect(shouldAlert(base, "otro", "Rubén")).toBe(false);
  });

  test("el texto lleva quién, qué y cuánto", () => {
    const { title, body } = expenseAlertText({ amount: 12.5, concept: "Cena", paidByName: "Clara" });
    expect(title).toContain("Clara");
    expect(body).toBe("Cena · 12,50 €");
  });
});
