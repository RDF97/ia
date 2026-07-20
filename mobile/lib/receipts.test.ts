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

// Ticket real de Lidl (con la barra de estado y cabecera del visor de fotos que
// se colaron al escanear un pantallazo, y productos que acaban en letra de IVA).
const LIDL = `23:09
18 jul 2026
LIDL SUPERMERCADOS S.A.U.
Barrio de S. Martiño, s/n
36711Areas-Tui
NIF A60195278
EUR
LIMA PACK 4 1,19 A
CAMPESINOS 0,89 A
PAN BURGER BRIOCHE 0,79 B
COSTILLAS SRIRACHA 6,99 B
PALETA DE CERDO 4,49x 2 8,98 B
------------
TOTAL 18,84
ENTREGA 18,84
------------
VENTA Visa Debit
18/07/2026 20:49:26
IVA% IVA + P N = PVP
A 4% 0,08 2,00 2,08
B 10% 1,52 15,24 16,76
Suma 1,60 17,24 18,84
GRACIAS POR SU VISITA`;

describe("parseReceipt · ticket Lidl real", () => {
  const r = parseReceipt(LIDL);

  it("ignora la barra de estado y coge el comercio (LIDL, no la fecha del visor)", () => {
    expect(r.merchant).toBe("LIDL SUPERMERCADOS S.A.U.");
  });

  it("coge el total 18,84 (no el subtotal ni la tabla de IVA)", () => {
    expect(r.total).toBeCloseTo(18.84);
  });

  it("fecha del ticket", () => {
    expect(r.date).toBe("2026-07-18");
  });

  it("extrae los 5 productos reales (con letra de IVA al final) y ninguna línea de IVA/pago", () => {
    expect(r.lines.map((l) => l.description)).toEqual([
      "LIMA PACK 4",
      "CAMPESINOS",
      "PAN BURGER BRIOCHE",
      "COSTILLAS SRIRACHA",
      "PALETA DE CERDO",
    ]);
    expect(r.lines.map((l) => l.total)).toEqual([1.19, 0.89, 0.79, 6.99, 8.98]);
    expect(r.lines.some((l) => /suma|iva|total|entrega|10%/i.test(l.description))).toBe(false);
  });
});
