import { beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";

process.env.PGLITE_DIR = "memory://";
process.env.TOKEN_ENCRYPTION_KEY = "0".repeat(64);

import { getDb, schema } from "../src/server/db";
import { runMigrations } from "../src/server/db/migrate";
import { ensureBeachConfig } from "../src/server/config/beaches";

let orgId: string;
let barcaId: string;
let mondragoId: string;
const DATE = "2026-07-25";

/**
 * Org tal y como quedó producción cuando Playa Barca y Mondragó eran dos playas
 * distintas: cada una con su "Kayak", su franja de las 10:00, su salida de ese
 * día y sus reservas. Al fusionarlas no puede perderse ninguna.
 */
beforeAll(async () => {
  await runMigrations();
  const db = await getDb();
  const [org] = await db
    .insert(schema.orgs)
    .values({ name: "Org Vieja", slug: "org-vieja" })
    .returning();
  orgId = org.id;

  for (const [name, sortOrder] of [
    ["Playa Barca", 1],
    ["Mondragó", 2],
  ] as const) {
    const [loc] = await db
      .insert(schema.locations)
      .values({ orgId, name, sortOrder })
      .returning();
    const [kayak] = await db
      .insert(schema.products)
      .values({ orgId, locationId: loc.id, name: "Kayak", sortOrder: 1 })
      .returning();
    const [slot] = await db
      .insert(schema.timeSlots)
      .values({
        orgId,
        locationId: loc.id,
        productId: kayak.id,
        startTime: "10:00",
        defaultCapacity: 12,
      })
      .returning();
    const [dep] = await db
      .insert(schema.departures)
      .values({
        orgId,
        timeSlotId: slot.id,
        locationId: loc.id,
        productId: kayak.id,
        date: DATE,
        startTime: "10:00",
      })
      .returning();
    await db.insert(schema.bookings).values({
      orgId,
      departureId: dep.id,
      source: "manual",
      externalRef: `PREVIA-${name}`,
      activityDate: DATE,
      activityTime: "10:00",
      productId: kayak.id,
      locationId: loc.id,
      paxAdults: 2,
      customerName: `Cliente de ${name}`,
    });
    if (name === "Playa Barca") barcaId = loc.id;
    else mondragoId = loc.id;
  }
});

describe("Playa Barca y Mondragó son la misma excursión", () => {
  it("las funde en una sola playa sin perder reservas", async () => {
    const db = await getDb();
    await ensureBeachConfig();

    const locs = await db.select().from(schema.locations).where(eq(schema.locations.orgId, orgId));
    expect(locs.map((l) => l.name).sort()).toEqual(["Cala Santanyí", "Playa Barca / Mondragó"]);

    const principal = locs.find((l) => l.name === "Playa Barca / Mondragó")!;
    // Sobrevive UNA de las dos playas anteriores (no una tercera nueva).
    expect([barcaId, mondragoId]).toContain(principal.id);

    // Las dos reservas siguen vivas y ahora cuelgan de la playa fusionada.
    const bookings = await db
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.orgId, orgId));
    expect(bookings).toHaveLength(2);
    expect(bookings.every((b) => b.locationId === principal.id)).toBe(true);
  });

  it("un solo Kayak, una sola franja de las 10:00 y una sola salida", async () => {
    const db = await getDb();
    const [principal] = await db
      .select()
      .from(schema.locations)
      .where(
        and(eq(schema.locations.orgId, orgId), eq(schema.locations.name, "Playa Barca / Mondragó")),
      );

    const kayaks = await db
      .select()
      .from(schema.products)
      .where(and(eq(schema.products.orgId, orgId), eq(schema.products.name, "Kayak")));
    expect(kayaks).toHaveLength(1);
    expect(kayaks[0].locationId).toBe(principal.id);

    const slots = await db
      .select()
      .from(schema.timeSlots)
      .where(and(eq(schema.timeSlots.orgId, orgId), eq(schema.timeSlots.productId, kayaks[0].id)));
    expect(slots).toHaveLength(1);

    // Lo importante: las dos reservas caen en la MISMA salida, así que el cupo
    // de las 10:00 cuenta 4 pax y no dos salidas de 2.
    const departures = await db
      .select()
      .from(schema.departures)
      .where(and(eq(schema.departures.orgId, orgId), eq(schema.departures.date, DATE)));
    expect(departures).toHaveLength(1);
    const bookings = await db
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.orgId, orgId));
    expect(bookings.every((b) => b.departureId === departures[0].id)).toBe(true);
  });
});

describe("ensureBeachConfig (idempotente)", () => {
  it("añade Cala Santanyí, Es Pontàs (cupo 22) y su regla a orgs existentes", async () => {
    await ensureBeachConfig();
    const db = await getDb();

    const [loc] = await db
      .select()
      .from(schema.locations)
      .where(and(eq(schema.locations.orgId, orgId), eq(schema.locations.name, "Cala Santanyí")));
    expect(loc).toBeTruthy();

    const [prod] = await db
      .select()
      .from(schema.products)
      .where(and(eq(schema.products.orgId, orgId), eq(schema.products.name, "Es Pontàs")));
    expect(prod).toBeTruthy();
    expect(prod.locationId).toBe(loc.id);

    const slots = await db
      .select()
      .from(schema.timeSlots)
      .where(and(eq(schema.timeSlots.orgId, orgId), eq(schema.timeSlots.productId, prod.id)));
    expect(slots).toHaveLength(1);
    expect(slots[0].defaultCapacity).toBe(22);

    const rules = await db
      .select()
      .from(schema.mappingRules)
      .where(
        and(
          eq(schema.mappingRules.orgId, orgId),
          eq(schema.mappingRules.targetProductId, prod.id),
        ),
      );
    expect(rules).toHaveLength(1);
    expect(rules[0].priority).toBe(5);
  });

  it("reejecutar no duplica ni vuelve a fusionar nada", async () => {
    const db = await getDb();
    await ensureBeachConfig();
    await ensureBeachConfig();

    const locs = await db.select().from(schema.locations).where(eq(schema.locations.orgId, orgId));
    expect(locs.map((l) => l.name).sort()).toEqual(["Cala Santanyí", "Playa Barca / Mondragó"]);
    const prods = await db
      .select()
      .from(schema.products)
      .where(and(eq(schema.products.orgId, orgId), eq(schema.products.name, "Es Pontàs")));
    expect(prods).toHaveLength(1);
    const bookings = await db
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.orgId, orgId));
    expect(bookings).toHaveLength(2);
  });
});
