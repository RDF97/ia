/**
 * Parche idempotente para bases de datos YA sembradas: añade la playa
 * "Cala Santanyí" con el producto "Es Pontàs" (cupo 22, monitor aparte) y su
 * regla de mapeo a cada org existente. `seed()` se salta las orgs que ya
 * existen, así que este script es el que lleva la novedad a producción.
 *
 *   npm run db:upgrade:santanyi
 *   # en el VPS:  docker compose exec web npx tsx scripts/upgrade-santanyi.ts
 *
 * Reejecutarlo no duplica nada (comprueba antes de insertar).
 */
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "../src/server/db";
import { runMigrations } from "../src/server/db/migrate";

const SANTANYI = "Cala Santanyí";
const PONTAS = "Es Pontàs";
const PONTAS_MATCH = "es pont[àa]s|pontas|santany";

export async function upgradeSantanyi() {
  await runMigrations();
  const db = await getDb();
  const orgs = await db.select().from(schema.orgs);

  for (const org of orgs) {
    // 1) Playa Cala Santanyí
    let [santanyi] = await db
      .select()
      .from(schema.locations)
      .where(and(eq(schema.locations.orgId, org.id), eq(schema.locations.name, SANTANYI)));
    if (!santanyi) {
      [santanyi] = await db
        .insert(schema.locations)
        .values({ orgId: org.id, name: SANTANYI, sortOrder: 2 })
        .returning();
      console.log(`[${org.slug}] + playa ${SANTANYI}`);
    }

    // 2) Producto Es Pontàs (+ franja cupo 22)
    let [pontas] = await db
      .select()
      .from(schema.products)
      .where(and(eq(schema.products.orgId, org.id), eq(schema.products.name, PONTAS)));
    if (!pontas) {
      [pontas] = await db
        .insert(schema.products)
        .values({ orgId: org.id, locationId: santanyi.id, name: PONTAS, sortOrder: 4 })
        .returning();
      console.log(`[${org.slug}] + producto ${PONTAS}`);
    }

    const slot = await db
      .select()
      .from(schema.timeSlots)
      .where(and(eq(schema.timeSlots.orgId, org.id), eq(schema.timeSlots.productId, pontas.id)));
    if (slot.length === 0) {
      await db.insert(schema.timeSlots).values({
        orgId: org.id,
        locationId: santanyi.id,
        productId: pontas.id,
        startTime: "10:30",
        defaultCapacity: 22,
      });
      console.log(`[${org.slug}] + franja 10:30 (cupo 22) para ${PONTAS}`);
    }

    // 3) Regla de mapeo → Es Pontàs / Cala Santanyí
    const rule = await db
      .select()
      .from(schema.mappingRules)
      .where(
        and(
          eq(schema.mappingRules.orgId, org.id),
          eq(schema.mappingRules.matchValue, PONTAS_MATCH),
        ),
      );
    if (rule.length === 0) {
      await db.insert(schema.mappingRules).values({
        orgId: org.id,
        priority: 5,
        matchType: "regex",
        matchValue: PONTAS_MATCH,
        targetProductId: pontas.id,
        targetLocationId: santanyi.id,
      });
      console.log(`[${org.slug}] + regla de mapeo Es Pontàs`);
    }
  }

  console.log(`Upgrade Santanyí completado sobre ${orgs.length} org(s).`);
}

if (process.argv[1]?.endsWith("upgrade-santanyi.ts")) {
  upgradeSantanyi().then(() => process.exit(0));
}
