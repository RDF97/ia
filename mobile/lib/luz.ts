// Lógica pura de la sección Luz (precios PVPC por horas + planificador).
// Portada del prototipo y testeable de forma aislada (sin React Native).

export type Tier = "ok" | "mid" | "hi";

export function tierOf(price: number, min: number, max: number): Tier {
  const t = (price - min) / (max - min || 1);
  if (t <= 0.34) return "ok";
  if (t >= 0.66) return "hi";
  return "mid";
}

export function avgWindow(prices: number[], start: number, len: number): number {
  let s = 0;
  for (let i = 0; i < len; i++) s += prices[start + i];
  return s / len;
}

export interface Window {
  start: number;
  avg: number;
}

export function cheapestWindow(prices: number[], len: number, from = 0): Window | null {
  let best: Window | null = null;
  for (let s = from; s + len <= prices.length; s++) {
    const avg = avgWindow(prices, s, len);
    if (!best || avg < best.avg) best = { start: s, avg };
  }
  return best;
}

export function priciestWindow(prices: number[], len: number): Window | null {
  let best: Window | null = null;
  for (let s = 0; s + len <= prices.length; s++) {
    const avg = avgWindow(prices, s, len);
    if (!best || avg > best.avg) best = { start: s, avg };
  }
  return best;
}

export function dayPart(h: number): string {
  if (h < 6) return "Madrugada";
  if (h < 12) return "Mañana";
  if (h < 16) return "Mediodía";
  if (h < 21) return "Tarde";
  return "Noche";
}

export interface Appliance {
  id: string;
  name: string;
  kwh: number;
  dur: number;
}

export interface Option {
  day: "Hoy" | "Mañana";
  start: number;
  avg: number;
}

/**
 * Las N franjas más baratas y bien repartidas para un electrodoméstico,
 * considerando hoy (desde la hora actual) y mañana (si está disponible).
 */
export function cheapestOptions(
  a: Pick<Appliance, "dur">,
  today: number[],
  tomorrow: number[] | null,
  nowHour: number,
  n = 3,
): Option[] {
  const cands: Option[] = [];
  for (let s = nowHour; s + a.dur <= 24; s++) {
    cands.push({ day: "Hoy", start: s, avg: avgWindow(today, s, a.dur) });
  }
  if (tomorrow) {
    for (let s = 0; s + a.dur <= 24; s++) {
      cands.push({ day: "Mañana", start: s, avg: avgWindow(tomorrow, s, a.dur) });
    }
  }
  cands.sort((x, y) => x.avg - y.avg);
  const gap = a.dur + 2; // separación mínima para cubrir franjas distintas
  const chosen: Option[] = [];
  for (const c of cands) {
    if (chosen.length >= n) break;
    const tooClose = chosen.some(
      (x) => x.day === c.day && Math.abs(c.start - x.start) < gap,
    );
    if (!tooClose) chosen.push(c);
  }
  return chosen;
}

export const pad = (n: number): string => String(n).padStart(2, "0");
export const hourLabel = (h: number): string => `${pad(((h % 24) + 24) % 24)}:00`;
export const rangeLabel = (start: number, len: number): string =>
  `${hourLabel(start)}–${hourLabel(start + len)}`;
export const fmtKwh = (p: number): string => p.toFixed(3).replace(".", ",");
export const fmtEur = (v: number): string => `${v.toFixed(2).replace(".", ",")} €`;
