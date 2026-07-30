import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

process.env.PGLITE_DIR = "memory://";
process.env.TOKEN_ENCRYPTION_KEY = "0".repeat(64);

import { getDb, schema } from "../src/server/db";
import { getBoard } from "../src/server/board/query";
import { ensureAdHocDeparture, ensureDeparture } from "../src/server/ingest/process";
import { seed } from "../scripts/seed";
import { beachColor } from "../src/server/board/rules";

let orgId: string;
const DATE = "2026-09-10";

beforeAll(async () => {
  orgId = (await seed()) as string;
  const db = await getDb();
  const slots = await db
    .select()
    .from(schema.timeSlots)
    .where(eq(schema.timeSlots.orgId, orgId));
  const kayak10 = slots.find((s) => s.startTime.startsWith("10:00"))!;
  const dep = await ensureDeparture(orgId, kayak10.id, DATE);
  await db.insert(schema.bookings).values({
    orgId,
    departureId: dep,
    source: "manual",
    channel: "Directa",
    externalRef: "VIS-1",
    activityDate: DATE,
    activityTime: kayak10.startTime,
    productId: kayak10.productId,
    locationId: kayak10.locationId,
    paxAdults: 3,
    customerName: "Cliente Uno",
  });
});

describe("cuadro más legible", () => {
  it("separa las franjas con reservas de las vacías", async () => {
    const board = await getBoard(orgId, DATE);
    const barca = board.locations.find((l) => l.name === "Playa Barca")!;
    // Solo la franja de las 10:00 tiene reservas…
    expect(barca.activeGroups).toHaveLength(1);
    expect(barca.activeGroups[0].startTime).toBe("10:00");
    // …y el resto queda aparte para poder ocultarlas.
    expect(barca.emptyGroups.length).toBeGreaterThan(0);
    expect(barca.emptyGroups.every((g) => g.paxTotal === 0)).toBe(true);
    // La suma sigue cuadrando con el total de franjas.
    expect(barca.activeGroups.length + barca.emptyGroups.length).toBe(barca.groups.length);
  });

  it("una salida creada a mano no se oculta aunque esté vacía", async () => {
    const db = await getDb();
    const slots = await db
      .select()
      .from(schema.timeSlots)
      .where(eq(schema.timeSlots.orgId, orgId));
    const kayak = slots.find((s) => s.startTime.startsWith("10:00"))!;
    // Salida ad-hoc a las 19:30, sin reservas todavía
    await ensureAdHocDeparture(orgId, DATE, "19:30", kayak.productId!, kayak.locationId, slots);
    const board = await getBoard(orgId, DATE);
    const barca = board.locations.find((l) => l.name === "Playa Barca")!;
    const adHoc = barca.activeGroups.find((g) => g.startTime === "19:30");
    expect(adHoc).toBeTruthy();
    expect(adHoc!.isAdHoc).toBe(true);
  });

  it("cada playa recibe un color propio y estable", async () => {
    const board = await getBoard(orgId, DATE);
    const colores = board.locations.map((l) => l.color.accent);
    expect(new Set(colores).size).toBe(board.locations.length);
    expect(board.locations[0].color).toEqual(beachColor(0));
  });
});
