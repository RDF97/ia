import { parseMoney, parseReceipt } from "./receipts";

describe("parseMoney", () => {
  it("coma decimal y punto de miles", () => {
    expect(parseMoney("0,89")).toBeCloseTo(0.89);
    expect(parseMoney("1.234,56")).toBeCloseTo(1234.56);
    expect(parseMoney("12.34")).toBeCloseTo(12.34);
    expect(parseMoney("4,04 €")).toBeCloseTo(4.04);
  });
});

const TICKET = `MERCADONA S.A.
C/ MAYOR 10 - MADRID
12/07/2026 18:32
LECHE ENTERA 0,89
PAN DE MOLDE 1,25
TOMATE FRITO 1,90
AGUA 1,5L 0,60
SUBTOTAL 4,64
TOTAL 4,64
TARJETA 4,64
GRACIAS POR SU VISITA`;

describe("parseReceipt", () => {
  const r = parseReceipt(TICKET);

  it("detecta el comercio (primera línea con letras, sin importe)", () => {
    expect(r.merchant).toBe("MERCADONA S.A.");
  });

  it("detecta la fecha en ISO", () => {
    expect(r.date).toBe("2026-07-12");
  });

  it("coge el TOTAL (no el subtotal ni el pago)", () => {
    expect(r.total).toBeCloseTo(4.64);
  });

  it("extrae las líneas de producto y descarta totales/pagos", () => {
    const desc = r.lines.map((l) => l.description);
    expect(desc).toEqual(["LECHE ENTERA", "PAN DE MOLDE", "TOMATE FRITO", "AGUA 1,5L"]);
    expect(r.lines[0].total).toBeCloseTo(0.89);
    expect(r.lines[3].total).toBeCloseTo(0.6);
    // no cuela ni SUBTOTAL ni TOTAL ni TARJETA
    expect(desc.some((d) => /total|tarjeta/i.test(d))).toBe(false);
  });

  it("si no hay línea TOTAL, usa el mayor importe", () => {
    const r2 = parseReceipt("CAFE 1,20\nBOLLO 2,50\nZUMO 1,80");
    expect(r2.total).toBeCloseTo(2.5);
  });
});
