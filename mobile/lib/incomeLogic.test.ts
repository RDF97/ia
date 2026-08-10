import { endOfMonth, monthBalance, savingsNotice } from "./incomeLogic";

describe("monthBalance", () => {
  test("cuánto queda y qué porción llevas gastada", () => {
    const b = monthBalance(2000, 500);
    expect(b.left).toBe(1500);
    expect(b.pct).toBeCloseTo(0.25, 5);
    expect(b.over).toBe(false);
  });

  test("pasarse deja el saldo en negativo y marca `over`", () => {
    const b = monthBalance(1000, 1200);
    expect(b.left).toBe(-200);
    expect(b.over).toBe(true);
    expect(b.pct).toBe(1); // la barra se llena, no se sale
  });

  test("sin ingreso no se inventa un porcentaje", () => {
    expect(monthBalance(0, 300).pct).toBe(0);
  });
});

describe("savingsNotice", () => {
  test("felicita con la cantidad ahorrada", () => {
    const n = savingsNotice(2000, 1500);
    expect(n.title).toContain("Felicidades");
    expect(n.body).toContain("500,00 €");
  });

  test("si te pasas lo dice, no felicita", () => {
    const n = savingsNotice(1000, 1200);
    expect(n.title).not.toContain("Felicidades");
    expect(n.body).toContain("200,00 €");
  });

  test("gastar justo el ingreso no es ahorro", () => {
    expect(savingsNotice(1000, 1000).body).toContain("Ni ahorro ni deuda");
  });
});

describe("endOfMonth", () => {
  test("último día del mes a las 23:59", () => {
    const d = endOfMonth(new Date(2026, 7, 9));
    expect(d.getDate()).toBe(31);
    expect(d.getMonth()).toBe(7);
    expect(d.getHours()).toBe(23);
  });

  test("febrero bisiesto", () => {
    expect(endOfMonth(new Date(2028, 1, 5)).getDate()).toBe(29);
  });
});
