import { DEFAULT_LEAD, LEAD_OPTIONS, leadLabel, normalizeLead } from "./leadTime";

describe("normalizeLead", () => {
  it("acepta las opciones de la lista", () => {
    for (const o of LEAD_OPTIONS) expect(normalizeLead(o.key)).toBe(o.key);
  });

  it("cae en 'a la hora' con null, undefined, NaN o un valor fuera de la lista", () => {
    for (const v of [null, undefined, NaN, Infinity, 7, -60, 99999]) {
      expect(normalizeLead(v as number)).toBe(DEFAULT_LEAD);
    }
  });

  it("el valor por defecto es avisar a la hora, no antes", () => {
    expect(DEFAULT_LEAD).toBe(0);
  });
});

describe("leadLabel", () => {
  it("devuelve la etiqueta corta de la opción", () => {
    expect(leadLabel(60)).toBe("1 h antes");
    expect(leadLabel(1440)).toBe("1 día antes");
  });

  it("con un valor que no existe, dice 'a la hora'", () => {
    expect(leadLabel(7)).toBe("a la hora");
  });
});
