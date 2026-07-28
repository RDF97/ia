import { beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";

process.env.PGLITE_DIR = "memory://";
process.env.TOKEN_ENCRYPTION_KEY = "0".repeat(64);

import { getDb, schema } from "../src/server/db";
import { runMigrations } from "../src/server/db/migrate";
import { ensureSantanyiConfig } from "../src/server/config/ensure-santanyi";

let orgId: string;

// Org "antigua" sin Cala Santanyí (como estaría producción antes del parche).
beforeAll(async () => {
  await runMigrations();
  const db = await getDb();
  const [org] = await db
    .insert(schema.orgs)
    .values({ name: "Org Vieja", slug: "org-vieja" })
    .returning();
  orgId = org.id;
  await db
    .insert(schema.locations)
    .values({ orgId, name: "Playa Barca / Mondragó", sortOrder: 1 });
});

describe("las tres playas (Playa Barca, Mondragó, Cala Santanyí)", () => {
  it("separa la playa combinada antigua en Playa Barca + Mondragó", async () => {
    const db = await getDb();
    // Reserva existente en la playa combinada: no debe perderse al dividir.
    const [combinedBefore] = await db
      .select()
      .from(schema.locations)
      .where(
        and(eq(schema.locations.orgId, orgId), eq(schema.locations.name, "Playa Barca / Mondragó")),
      );
    const [booking] = await db
      .insert(schema.bookings)
      .values({
        orgId,
        source: "manual",
        externalRef: "PREVIA-1",
        activityDate: "2026-07-25",
        locationId: combinedBefore.id,
        paxAdults: 2,
        customerName: "Reserva previa",
      })
      .returning();

    await ensureSantanyiConfig();

    const locs = await db
      .select()
      .from(schema.locations)
      .where(eq(schema.locations.orgId, orgId));
    const names = locs.map((l) => l.name).sort();
    expect(names).toEqual(["Cala Santanyí", "Mondragó", "Playa Barca"]);
    // La combinada ya no existe con el nombre viejo…
    expect(names).not.toContain("Playa Barca / Mondragó");
    // …y la reserva sigue viva, ahora en Playa Barca.
    const [after] = await db
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.id, booking.id));
    const [loc] = await db
      .select()
      .from(schema.locations)
      .where(eq(schema.locations.id, after.locationId!));
    expect(loc.name).toBe("Playa Barca");
  });
});

describe("ensureSantanyiConfig (idempotente)", () => {
  it("añade Cala Santanyí, Es Pontàs (cupo 22) y su regla a orgs existentes", async () => {
    await ensureSantanyiConfig();
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

  it("reejecutar no duplica nada", async () => {
    await ensureSantanyiConfig();
    await ensureSantanyiConfig();
    const db = await getDb();
    const locs = await db
      .select()
      .from(schema.locations)
      .where(and(eq(schema.locations.orgId, orgId), eq(schema.locations.name, "Cala Santanyí")));
    const prods = await db
      .select()
      .from(schema.products)
      .where(and(eq(schema.products.orgId, orgId), eq(schema.products.name, "Es Pontàs")));
    expect(locs).toHaveLength(1);
    expect(prods).toHaveLength(1);
  });
});
