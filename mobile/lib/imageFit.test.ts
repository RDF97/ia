import { fitForOcr, MAX_ALTO, MAX_ANCHO } from "./imageFit";

describe("fitForOcr · a qué tamaño mandar el ticket", () => {
  it("un ticket largo conserva el ancho que hace falta para leerlo", () => {
    // El caso que fallaba: limitando el lado largo a 2200 esto quedaba en
    // 733 px de ancho y el texto era ilegible.
    const f = fitForOcr(3000, 9000);
    expect(f.width).toBe(MAX_ANCHO);
    expect(f.height).toBe(4200);
  });

  it("un ticket normal se reduce por el ancho", () => {
    expect(fitForOcr(3000, 4000)).toEqual({ width: 1400, height: 1867 });
  });

  it("uno absurdamente largo lo frena el tope de alto", () => {
    const f = fitForOcr(2000, 20000);
    expect(f).toEqual({ width: 440, height: MAX_ALTO });
    expect(f.width / f.height!).toBeCloseTo(2000 / 20000, 3);
  });

  it("no agranda una foto que ya es pequeña", () => {
    expect(fitForOcr(800, 1200)).toEqual({ width: 800, height: 1200 });
  });

  it("si no se sabe el tamaño, manda solo el ancho", () => {
    // Devolver aquí un alto de 0 dejaba la foto en nada y no se leía ningún ticket.
    expect(fitForOcr(0, 0)).toEqual({ width: MAX_ANCHO });
  });
});
