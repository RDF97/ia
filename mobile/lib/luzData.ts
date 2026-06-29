// Capa de datos de precios PVPC. Intenta REE (oficial) → preciodelaluz (CORS) →
// datos de ejemplo. Las funciones de parseo son puras y testeables.
import { samplePrices } from "./samplePrices";

export type LuzSource = "real" | "pdl" | "sample";

export interface LuzData {
  today: number[];
  tomorrow: number[] | null;
  source: LuzSource;
}

export function validDay(arr: (number | null)[] | null | undefined): arr is number[] {
  return (
    Array.isArray(arr) &&
    arr.length === 24 &&
    arr.every((x) => typeof x === "number" && isFinite(x) && x > 0)
  );
}

// Red Eléctrica: agrupa por fecha/hora del propio string ISO (hora peninsular),
// independiente de la zona horaria del dispositivo. Convierte €/MWh → €/kWh.
export function parseREE(json: any): { today: number[] | null; tomorrow: number[] | null } {
  const series: any[] = json?.included ?? [];
  const pvpc =
    series.find((s) => /PVPC/i.test(s?.attributes?.title ?? "")) ??
    series.find((s) => /spot|mercado/i.test(s?.attributes?.title ?? ""));
  if (!pvpc) throw new Error("REE: sin serie PVPC");
  const byDate: Record<string, number[]> = {};
  for (const v of pvpc.attributes?.values ?? []) {
    const m = /^(\d{4}-\d{2}-\d{2})T(\d{2})/.exec(v?.datetime ?? "");
    if (!m) continue;
    if (!byDate[m[1]]) byDate[m[1]] = new Array(24).fill(null);
    byDate[m[1]][parseInt(m[2], 10)] = v.value / 1000;
  }
  const dates = Object.keys(byDate).sort();
  return {
    today: dates[0] ? byDate[dates[0]] : null,
    tomorrow: dates[1] ? byDate[dates[1]] : null,
  };
}

// preciodelaluz.org (solo hoy). Normaliza €/MWh → €/kWh.
export function parsePDL(data: any): number[] {
  const today: (number | null)[] = new Array(24).fill(null);
  Object.values(data ?? {}).forEach((o: any) => {
    if (!o || typeof o.hour === "undefined") return;
    const h = parseInt(String(o.hour).slice(0, 2), 10);
    const p = o.price > 5 ? o.price / 1000 : o.price;
    if (!isNaN(h) && h >= 0 && h < 24) today[h] = p;
  });
  return today as number[];
}

function isoLocal(d: Date, end?: boolean): string {
  const z = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${end ? "23:59" : "00:00"}`;
}

export async function fetchLuzPrices(): Promise<LuzData> {
  // 1) Red Eléctrica (oficial): hoy + mañana
  try {
    const now = new Date();
    const tom = new Date(now);
    tom.setDate(now.getDate() + 1);
    const url =
      "https://apidatos.ree.es/es/datos/mercados/precios-mercados-tiempo-real" +
      `?start_date=${isoLocal(now)}&end_date=${isoLocal(tom, true)}` +
      "&time_trunc=hour&geo_limit=peninsular&geo_ids=8741";
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (res.ok) {
      const { today, tomorrow } = parseREE(await res.json());
      if (validDay(today)) {
        return { today, tomorrow: validDay(tomorrow) ? tomorrow : null, source: "real" };
      }
    }
  } catch {
    /* sigue al respaldo */
  }
  // 2) preciodelaluz (con CORS, sin token): solo hoy
  try {
    const res = await fetch("https://api.preciodelaluz.org/v1/prices/all?zone=PCB");
    if (res.ok) {
      const today = parsePDL(await res.json());
      if (validDay(today)) return { today, tomorrow: null, source: "pdl" };
    }
  } catch {
    /* sigue al fallback */
  }
  // 3) datos de ejemplo
  return { today: samplePrices.today, tomorrow: samplePrices.tomorrow, source: "sample" };
}
