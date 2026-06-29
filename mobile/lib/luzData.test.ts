import { parseREE, parsePDL, validDay } from "./luzData";

function reePayload(dates: string[]) {
  const values: { value: number; datetime: string }[] = [];
  dates.forEach((d, di) => {
    for (let h = 0; h < 24; h++) {
      values.push({
        value: 100 + di * 100 + h, // €/MWh
        datetime: `${d}T${String(h).padStart(2, "0")}:00:00.000+02:00`,
      });
    }
  });
  return { included: [{ attributes: { title: "PVPC (€/MWh)", values } }] };
}

describe("luzData · parsers", () => {
  test("parseREE convierte €/MWh→€/kWh y reparte hoy/mañana (sin depender de TZ)", () => {
    const { today, tomorrow } = parseREE(reePayload(["2026-06-29", "2026-06-30"]));
    expect(validDay(today)).toBe(true);
    expect(validDay(tomorrow)).toBe(true);
    expect(today![0]).toBeCloseTo(0.1, 5);
    expect(today![23]).toBeCloseTo(0.123, 5);
    expect(tomorrow![0]).toBeCloseTo(0.2, 5);
  });

  test("parseREE devuelve tomorrow=null si solo hay un día", () => {
    const { today, tomorrow } = parseREE(reePayload(["2026-06-29"]));
    expect(validDay(today)).toBe(true);
    expect(tomorrow).toBeNull();
  });

  test("parseREE lanza si no hay serie PVPC", () => {
    expect(() => parseREE({ included: [] })).toThrow();
  });

  test("parsePDL normaliza €/MWh→€/kWh", () => {
    const data: Record<string, { hour: string; price: number }> = {};
    for (let h = 0; h < 24; h++) {
      const k = `${String(h).padStart(2, "0")}-${String(h + 1).padStart(2, "0")}`;
      data[k] = { hour: k, price: 120 + h };
    }
    const today = parsePDL(data);
    expect(validDay(today)).toBe(true);
    expect(today[0]).toBeCloseTo(0.12, 5);
  });

  test("validDay rechaza arrays incompletos o con ceros", () => {
    expect(validDay(null)).toBe(false);
    expect(validDay(new Array(23).fill(0.1))).toBe(false);
    expect(validDay([...new Array(23).fill(0.1), 0])).toBe(false);
  });
});
