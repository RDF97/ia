import { applianceReminder, cheapHourAlerts, expensiveStretchAlert } from "./luzAlerts";
import { samplePrices } from "./samplePrices";

const { today, tomorrow } = samplePrices;

// "Ahora" fijo para tests deterministas: 10:30 de la mañana
const NOW = new Date(2026, 6, 10, 10, 30, 0);

describe("luzAlerts · avisos locales", () => {
  test("cheapHourAlerts programa hoy (solo horas futuras) y mañana", () => {
    const alerts = cheapHourAlerts(today, tomorrow, NOW);
    expect(alerts).toHaveLength(2);
    // La hora de hoy debe ser futura
    expect(alerts[0].date.getTime()).toBeGreaterThan(NOW.getTime());
    expect(alerts[0].date.getDate()).toBe(NOW.getDate());
    // La de mañana cae al día siguiente en la hora más barata (05:00 en sample)
    expect(alerts[1].date.getDate()).toBe(NOW.getDate() + 1);
    expect(alerts[1].date.getHours()).toBe(tomorrow.indexOf(Math.min(...tomorrow)));
  });

  test("cheapHourAlerts sin datos de mañana → solo 1 aviso", () => {
    expect(cheapHourAlerts(today, null, NOW)).toHaveLength(1);
  });

  test("expensiveStretchAlert avisa 15 min antes del próximo tramo caro", () => {
    const a = expensiveStretchAlert(today, NOW);
    expect(a).not.toBeNull();
    // En sample el tramo caro empieza a las 19:00 y el aviso va 15 min antes
    expect(a!.date.getHours()).toBe(18);
    expect(a!.date.getMinutes()).toBe(45);
    expect(a!.body).toContain("Evita consumir");
  });

  test("applianceReminder resta los minutos de antelación", () => {
    const r = applianceReminder("Hoy", 14, "Lavadora", 0.108, 2, NOW);
    expect(r).not.toBeNull();
    expect(r!.date.getHours()).toBe(13);
    expect(r!.date.getMinutes()).toBe(50);
  });

  test("applianceReminder para mañana suma un día", () => {
    const r = applianceReminder("Mañana", 4, "Lavadora", 0.09, 2, NOW);
    expect(r!.date.getDate()).toBe(NOW.getDate() + 1);
    expect(r!.date.getHours()).toBe(3);
  });

  test("applianceReminder devuelve null si la franja ya pasó", () => {
    expect(applianceReminder("Hoy", 8, "Horno", 0.1, 1, NOW)).toBeNull();
  });
});
