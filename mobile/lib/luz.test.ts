import {
  tierOf,
  cheapestWindow,
  cheapestOptions,
  cheapStretches,
  dayPart,
  rangeLabel,
} from "./luz";
import { samplePrices } from "./samplePrices";

const { today, tomorrow } = samplePrices;

describe("luz · lógica de precios", () => {
  test("tierOf clasifica por percentiles relativos", () => {
    expect(tierOf(0, 0, 10)).toBe("ok");
    expect(tierOf(5, 0, 10)).toBe("mid");
    expect(tierOf(10, 0, 10)).toBe("hi");
  });

  test("cheapestWindow encuentra la franja más barata", () => {
    const w = cheapestWindow(today, 1);
    expect(w).not.toBeNull();
    // La hora más barata de hoy es las 04:00 (0,089)
    expect(w!.start).toBe(4);
  });

  test("cheapestWindow respeta el parámetro 'from'", () => {
    const w = cheapestWindow(today, 1, 18);
    expect(w!.start).toBeGreaterThanOrEqual(18);
  });

  test("dayPart etiqueta las franjas del día", () => {
    expect(dayPart(3)).toBe("Madrugada");
    expect(dayPart(13)).toBe("Mediodía");
    expect(dayPart(22)).toBe("Noche");
  });

  test("cheapestOptions devuelve opciones repartidas (no pegadas)", () => {
    const opts = cheapestOptions({ dur: 2 }, today, tomorrow, 0, 3);
    expect(opts).toHaveLength(3);
    // Ordenadas de más barata a menos
    expect(opts[0].avg).toBeLessThanOrEqual(opts[1].avg);
    expect(opts[1].avg).toBeLessThanOrEqual(opts[2].avg);
    // Separación dentro del mismo día (gap = dur + 2 = 4)
    const sameDay = opts.filter((o) => o.day === opts[0].day);
    for (let i = 1; i < sameDay.length; i++) {
      expect(Math.abs(sameDay[i].start - sameDay[0].start)).toBeGreaterThanOrEqual(4);
    }
  });

  test("cheapestOptions excluye mañana si no está disponible", () => {
    const opts = cheapestOptions({ dur: 2 }, today, null, 0, 3);
    expect(opts.every((o) => o.day === "Hoy")).toBe(true);
  });

  test("rangeLabel formatea correctamente y cruza medianoche", () => {
    expect(rangeLabel(4, 2)).toBe("04:00–06:00");
    expect(rangeLabel(23, 2)).toBe("23:00–01:00");
  });

  test("cheapStretches detecta franjas valle ordenadas por precio", () => {
    const stretches = cheapStretches(today);
    expect(stretches.length).toBeGreaterThan(0);
    // La madrugada (incluye la hora más barata, 04:00) debe ser el tramo top
    expect(stretches[0].start).toBeLessThanOrEqual(4);
    expect(stretches[0].end).toBeGreaterThanOrEqual(4);
    // Ordenados ascendente por media
    for (let i = 1; i < stretches.length; i++) {
      expect(stretches[i - 1].avg).toBeLessThanOrEqual(stretches[i].avg);
    }
  });
});
