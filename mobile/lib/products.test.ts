import { latestByStore, normalizeName } from "./products";

describe("products · lógica pura", () => {
  test("normalizeName recorta y colapsa espacios", () => {
    expect(normalizeName("  Leche   entera  1L ")).toBe("Leche entera 1L");
  });

  test("latestByStore se queda con el precio más reciente de cada súper y ordena por precio", () => {
    // Ordenado de más reciente a más antiguo (como devuelve la query)
    const points = [
      { store: "Mercadona", price: 1.15, at: "2026-07-10" },
      { store: "Día", price: 1.09, at: "2026-07-08" },
      { store: "Mercadona", price: 1.05, at: "2026-07-01" }, // más antiguo: ignorado
      { store: "Lidl", price: 1.19, at: "2026-06-20" },
    ];
    const res = latestByStore(points);
    expect(res.map((r) => r.store)).toEqual(["Día", "Mercadona", "Lidl"]);
    expect(res[1].price).toBe(1.15); // el reciente de Mercadona, no el 1.05 antiguo
  });

  test("latestByStore ignora mayúsculas/minúsculas al agrupar", () => {
    const res = latestByStore([
      { store: "dia", price: 1.2, at: "2026-07-10" },
      { store: "Día", price: 1.0, at: "2026-07-01" },
      { store: "DIA", price: 1.1, at: "2026-07-05" },
    ]);
    // "dia"/"Día"/"DIA" difieren en acento: 'día' vs 'dia' son claves distintas
    expect(res.length).toBe(2);
  });
});
