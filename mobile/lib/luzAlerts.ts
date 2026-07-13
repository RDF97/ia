// Decide qué notificaciones locales programar a partir de los precios PVPC.
// Lógica pura (sin dependencias nativas) para poder testearla.
import { fmtKwh, hourLabel, rangeLabel, tierOf } from "./luz";

export interface PlannedNotification {
  date: Date;
  title: string;
  body: string;
}

function atHour(base: Date, hour: number, plusDays = 0, minusMinutes = 0): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + plusDays);
  d.setHours(hour, 0, 0, 0);
  d.setMinutes(d.getMinutes() - minusMinutes);
  return d;
}

/** Aviso al llegar la hora más barata (hoy si aún no pasó, y mañana si hay datos). */
export function cheapHourAlerts(
  today: number[],
  tomorrow: number[] | null,
  now: Date,
): PlannedNotification[] {
  const out: PlannedNotification[] = [];
  const curHour = now.getHours();
  // Hoy: la hora más barata que quede por llegar
  let best = -1;
  for (let h = curHour + 1; h < 24; h++) {
    if (best === -1 || today[h] < today[best]) best = h;
  }
  if (best !== -1) {
    out.push({
      date: atHour(now, best),
      title: "⚡ Hora barata de la luz",
      body: `Ahora es buen momento: ${rangeLabel(best, 1)} a ${fmtKwh(today[best])} €/kWh.`,
    });
  }
  if (tomorrow) {
    const min = Math.min(...tomorrow);
    const h = tomorrow.indexOf(min);
    out.push({
      date: atHour(now, h, 1),
      title: "⚡ Hora barata de la luz",
      body: `Ahora es buen momento: ${rangeLabel(h, 1)} a ${fmtKwh(min)} €/kWh.`,
    });
  }
  return out;
}

/** Aviso 15 min antes del próximo tramo caro de hoy. */
export function expensiveStretchAlert(
  today: number[],
  now: Date,
): PlannedNotification | null {
  const min = Math.min(...today);
  const max = Math.max(...today);
  const curHour = now.getHours();
  let start = -1;
  for (let h = curHour + 1; h < 24; h++) {
    if (tierOf(today[h], min, max) === "hi") {
      start = h;
      break;
    }
  }
  if (start === -1) return null;
  let end = start;
  while (end + 1 < 24 && tierOf(today[end + 1], min, max) === "hi") end++;
  return {
    date: atHour(now, start, 0, 15),
    title: "🔴 Tramo caro de la luz",
    body: `De ${hourLabel(start)} a ${hourLabel(end + 1)} la luz está cara (hasta ${fmtKwh(Math.max(...today.slice(start, end + 1)))} €/kWh). Evita consumir si puedes.`,
  };
}

/** Recordatorio para un electrodoméstico programado (X min antes; si ya pasó, al empezar). */
export function applianceReminder(
  day: "Hoy" | "Mañana",
  startHour: number,
  applianceName: string,
  avg: number,
  dur: number,
  now: Date,
  minutesBefore = 10,
): PlannedNotification | null {
  const plusDays = day === "Mañana" ? 1 : 0;
  let date = atHour(now, startHour, plusDays, minutesBefore);
  if (date.getTime() <= now.getTime()) date = atHour(now, startHour, plusDays);
  if (date.getTime() <= now.getTime()) return null;
  return {
    date,
    title: `🕐 ${applianceName}`,
    body: `Tu franja barata empieza a las ${hourLabel(startHour)} (${rangeLabel(startHour, dur)} · ${fmtKwh(avg)} €/kWh media).`,
  };
}
