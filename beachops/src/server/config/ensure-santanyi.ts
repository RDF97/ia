/**
 * Asegura, de forma idempotente, que cada org tiene la playa "Cala Santanyí"
 * con el producto "Es Pontàs" (cupo 22, monitor aparte), su franja y la regla de
 * mapeo. `seed()` se salta las orgs ya existentes, así que esta función es la que
 * lleva la novedad a bases de datos ya sembradas (producción). Se llama al
 * arrancar el worker (cada redeploy) y desde el botón "Reprocesar reservas".
 *
 * Reejecutarla no duplica nada (comprueba antes de insertar).
 */
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "../db";

const SANTANYI = "Cala Santanyí";
const PONTAS = "Es Pontàs";
const PONTAS_MATCH = "es pont[àa]s|pontas|santany";

export async function ensureSantanyiConfig(): Promise<void> {
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
}
