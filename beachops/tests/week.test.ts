import { beforeAll, describe, expect, it } from "vitest";

process.env.PGLITE_DIR = "memory://";
process.env.TOKEN_ENCRYPTION_KEY = "0".repeat(64);

import { getWeek, mondayOf } from "../src/server/board/week";
import { seed } from "../scripts/seed";
import { getDb, schema } from "../src/server/db";
import { ensureDeparture } from "../src/server/ingest/process";
import { eq } from "drizzle-orm";

let orgId: string;

beforeAll(async () => {
  orgId = (await seed()) as string;
  const db = await getDb();
  const slots = await db
    .select()
    .from(schema.timeSlots)
    .where(eq(schema.timeSlots.orgId, orgId));
  const kayak1230 = slots.find((s) => s.startTime.startsWith("12:30") && s.defaultCapacity === 12)!;
  // Viernes 2026-07-10: 13 pax en el 12:30 (sobre-reserva de +1)
  const departureId = await ensureDeparture(orgId, kayak1230.id, "2026-07-10");
  await db.insert(schema.bookings).values({
    orgId,
    departureId,
    source: "manual",
    channel: "Directa",
    status: "confirmed",
    activityDate: "2026-07-10",
    activityTime: "12:30",
    paxAdults: 12,
    paxChildren: 1,
    customerName: "Grupo grande",
  });
});

describe("vista semanal", () => {
  it("mondayOf devuelve el lunes de la semana", () => {
    expect(mondayOf("2026-07-10")).toBe("2026-07-06"); // viernes → lunes
    expect(mondayOf("2026-07-06")).toBe("2026-07-06"); // lunes → sí mismo
    expect(mondayOf("2026-07-12")).toBe("2026-07-06"); // domingo → lunes anterior
  });

  it("agrega pax por día y franja, y marca la sobre-reserva", async () => {
    const week = await getWeek(orgId, "2026-07-06");
    expect(week.days).toHaveLength(7);
    expect(week.days[4]).toBe("2026-07-10");

    const friday = week.dayTotals[4];
    expect(friday.paxTotal).toBe(13);
    expect(friday.paxAdults).toBe(12);
    expect(friday.paxChildren).toBe(1);

    const row1230 = week.rows.find((r) => r.startTime === "12:30" && r.cells[4]?.paxTotal === 13);
    expect(row1230).toBeDefined();
    expect(row1230!.cells[4]!.overbooked).toBe(true);
    expect(row1230!.cells[4]!.capacity).toBe(12);
    // El resto de la semana, vacío
    expect(week.dayTotals[0].paxTotal).toBe(0);
  });
});
