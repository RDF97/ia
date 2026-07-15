import { detectDelimiter, guessMapping, latin1FromBase64, looksMojibake, parseAmount, parseBankRows, parseCsv, parseDate } from "./csv";
import { reconcile, reconSummary } from "./reconcile";

describe("codificación latin-1", () => {
  it("detecta mojibake (U+FFFD)", () => {
    expect(looksMojibake("N�mina")).toBe(true);
    expect(looksMojibake("Nómina")).toBe(false);
  });
  it("decodifica base64 latin-1 con acentos", () => {
    // bytes ISO-8859-1 de "Nómina" → N(0x4e) ó(0xf3) m(0x6d) i(0x69) n(0x6e) a(0x61)
    const b64 = "TvNtaW5h";
    expect(latin1FromBase64(b64)).toBe("Nómina");
  });
});

describe("parseCsv", () => {
  it("detecta ; como separador y respeta comillas", () => {
    expect(detectDelimiter("a;b;c")).toBe(";");
    const rows = parseCsv('Fecha;Concepto;Importe\n01/07/2026;"Pago, tienda";-12,50');
    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual(["01/07/2026", "Pago, tienda", "-12,50"]);
  });

  it("ignora filas vacías", () => {
    expect(parseCsv("a,b\n\n c , d \n")).toHaveLength(2);
  });
});

describe("parseAmount", () => {
  it("formato español -1.234,56", () => expect(parseAmount("-1.234,56")).toBeCloseTo(-1234.56));
  it("formato inglés 1,234.56", () => expect(parseAmount("1,234.56")).toBeCloseTo(1234.56));
  it("coma decimal simple", () => expect(parseAmount("12,50")).toBeCloseTo(12.5));
  it("paréntesis como negativo y símbolo €", () => expect(parseAmount("(45,00) €")).toBeCloseTo(-45));
  it("vacío → null", () => expect(parseAmount("")).toBeNull());
});

describe("parseDate", () => {
  it("dd/mm/aaaa", () => expect(parseDate("01/07/2026")!.slice(0, 10)).toBe("2026-07-01"));
  it("aaaa-mm-dd", () => expect(parseDate("2026-07-01")!.slice(0, 10)).toBe("2026-07-01"));
  it("dd-mm-aa", () => expect(parseDate("01-07-26")!.slice(0, 10)).toBe("2026-07-01"));
  it("inválida → null", () => expect(parseDate("nope")).toBeNull());
});

describe("guessMapping + parseBankRows", () => {
  const rows = parseCsv("Fecha;Concepto;Importe\n05/07/2026;Mercadona;-40,00\n06/07/2026;Nómina;1200,00\nmalo;;x");
  it("adivina columnas por encabezado", () => {
    expect(guessMapping(rows[0])).toEqual({ date: 0, concept: 1, amount: 2 });
  });
  it("descarta filas sin fecha/importe válidos", () => {
    const movs = parseBankRows(rows, { date: 0, concept: 1, amount: 2 }, true);
    expect(movs).toHaveLength(2);
    expect(movs[0]).toEqual({ date: expect.any(String), concept: "Mercadona", amount: -40 });
    expect(movs[1].amount).toBeCloseTo(1200);
  });
});

describe("reconcile", () => {
  const movs = [
    { date: "2026-07-05T12:00:00.000Z", concept: "Mercadona", amount: -40 },
    { date: "2026-07-06T12:00:00.000Z", concept: "Gasolina", amount: -60 },
    { date: "2026-07-06T12:00:00.000Z", concept: "Nómina", amount: 1200 },
  ];
  const expenses = [
    { $id: "e1", amount: 40, $createdAt: "2026-07-05T18:00:00.000Z" }, // casa con Mercadona
    { $id: "e2", amount: 99, $createdAt: "2026-07-06T10:00:00.000Z" }, // no casa
  ];

  it("casa por importe y fecha cercana; abonos no se concilian", () => {
    const res = reconcile(movs, expenses, 3);
    expect(res[0].matchedId).toBe("e1");
    expect(res[1].matchedId).toBeNull(); // gasolina falta por registrar
    expect(res[2].income).toBe(true);
  });

  it("no reutiliza el mismo gasto para dos movimientos", () => {
    const two = [
      { date: "2026-07-05T12:00:00.000Z", concept: "A", amount: -40 },
      { date: "2026-07-05T12:00:00.000Z", concept: "B", amount: -40 },
    ];
    const res = reconcile(two, [{ $id: "e1", amount: 40, $createdAt: "2026-07-05T12:00:00.000Z" }], 3);
    expect(res.filter((r) => r.matchedId === "e1")).toHaveLength(1);
    expect(res.filter((r) => r.matchedId === null)).toHaveLength(1);
  });

  it("fuera de tolerancia de fecha → no casa", () => {
    const res = reconcile([{ date: "2026-07-01T12:00:00.000Z", concept: "X", amount: -40 }], expenses, 3);
    expect(res[0].matchedId).toBeNull();
  });

  it("reconSummary cuenta cargos, casados, faltantes e ingresos", () => {
    expect(reconSummary(reconcile(movs, expenses, 3))).toEqual({ charges: 2, matched: 1, missing: 1, income: 1 });
  });
});
