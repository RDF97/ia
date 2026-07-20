import { beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";

process.env.PGLITE_DIR = "memory://";
process.env.TOKEN_ENCRYPTION_KEY = "0".repeat(64);

import { getDb, schema } from "../src/server/db";
import { runMigrations } from "../src/server/db/migrate";
import { upgradeSantanyi } from "../scripts/upgrade-santanyi";

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

describe("upgrade-santanyi (parche idempotente)", () => {
  it("añade Cala Santanyí, Es Pontàs (cupo 22) y su regla a orgs existentes", async () => {
    await upgradeSantanyi();
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
    await upgradeSantanyi();
    await upgradeSantanyi();
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
