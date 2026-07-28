/**
 * Asegura, de forma idempotente, la configuración de playas de Secret Point:
 * las TRES playas reales (Playa Barca, Mondragó y Cala Santanyí) con sus
 * productos y franjas. `seed()` se salta las orgs ya existentes, así que esta
 * función es la que lleva los cambios a bases ya sembradas (producción). Se
 * llama al arrancar el worker (cada redeploy) y desde "Reprocesar reservas".
 *
 * Reejecutarla no duplica nada (comprueba antes de insertar).
 */
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "../db";

const SANTANYI = "Cala Santanyí";
const PONTAS = "Es Pontàs";
const PONTAS_MATCH = "es pont[àa]s|pontas|santany";
/** Nombre antiguo: unía dos playas distintas en una sola. */
const LEGACY_COMBINED = "Playa Barca / Mondragó";
const PLAYA_BARCA = "Playa Barca";
const MONDRAGO = "Mondragó";

/**
 * @returns `true` si en ESTA ejecución se creó por primera vez la playa Cala
 * Santanyí en alguna org (señal de que hay que reprocesar las reservas para
 * repartirlas a su playa).
 */
export async function ensureSantanyiConfig(): Promise<boolean> {
  const db = await getDb();
  const orgs = await db.select().from(schema.orgs);
  let createdLocation = false;

  for (const org of orgs) {
    // 0) Playa Barca y Mondragó son DOS playas distintas. Las bases antiguas
    // las tenían unidas en "Playa Barca / Mondragó": se renombra a "Playa Barca"
    // (conservando sus reservas, productos y franjas) y se crea Mondragó aparte.
    const [combined] = await db
      .select()
      .from(schema.locations)
      .where(and(eq(schema.locations.orgId, org.id), eq(schema.locations.name, LEGACY_COMBINED)));
    if (combined) {
      await db
        .update(schema.locations)
        .set({ name: PLAYA_BARCA, sortOrder: 1 })
        .where(eq(schema.locations.id, combined.id));
      console.log(`[${org.slug}] "${LEGACY_COMBINED}" → "${PLAYA_BARCA}"`);
    }

    const [mondragoExisting] = await db
      .select()
      .from(schema.locations)
      .where(and(eq(schema.locations.orgId, org.id), eq(schema.locations.name, MONDRAGO)));
    if (!mondragoExisting) {
      const [mondrago] = await db
        .insert(schema.locations)
        .values({ orgId: org.id, name: MONDRAGO, sortOrder: 2 })
        .returning();
      console.log(`[${org.slug}] + playa ${MONDRAGO}`);
      // Mondragó necesita sus propios productos y franjas para poder recibir
      // reservas; se replican los de Playa Barca (editable luego en /config).
      const barcaProducts = combined
        ? await db
            .select()
            .from(schema.products)
            .where(and(eq(schema.products.orgId, org.id), eq(schema.products.locationId, combined.id)))
        : [];
      for (const p of barcaProducts.filter((p) => p.kind === "tour")) {
        const [copy] = await db
          .insert(schema.products)
          .values({
            orgId: org.id,
            locationId: mondrago.id,
            name: p.name,
            kind: p.kind,
            sortOrder: p.sortOrder,
          })
          .returning();
        const slots = await db
          .select()
          .from(schema.timeSlots)
          .where(and(eq(schema.timeSlots.orgId, org.id), eq(schema.timeSlots.productId, p.id)));
        for (const s of slots) {
          await db.insert(schema.timeSlots).values({
            orgId: org.id,
            locationId: mondrago.id,
            productId: copy.id,
            startTime: s.startTime,
            defaultCapacity: s.defaultCapacity,
          });
        }
      }
    }

    // 1) Playa Cala Santanyí
    let [santanyi] = await db
      .select()
      .from(schema.locations)
      .where(and(eq(schema.locations.orgId, org.id), eq(schema.locations.name, SANTANYI)));
    if (!santanyi) {
      [santanyi] = await db
        .insert(schema.locations)
        .values({ orgId: org.id, name: SANTANYI, sortOrder: 3 })
        .returning();
      createdLocation = true;
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

  return createdLocation;
}
