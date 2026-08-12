/**
 * Asegura, de forma idempotente, la configuración de playas de Secret Point:
 *
 *   1. **Playa Barca / Mondragó** — una sola playa. Son la MISMA excursión: se
 *      sale del mismo sitio, con el mismo material y el mismo monitor. Tenerlas
 *      separadas partía en dos el cupo de una salida que en realidad es una.
 *   2. **Cala Santanyí** — la excepción: producto "Es Pontàs", cupo 22 y monitor
 *      independiente.
 *
 * `seed()` se salta las orgs que ya existen, así que esta función es la que
 * lleva los cambios a bases ya sembradas (producción). Se llama al arrancar el
 * worker (cada redeploy) y desde "Reprocesar reservas".
 *
 * Reejecutarla no duplica ni rompe nada: comprueba antes de tocar.
 */
import { and, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "../db";
import { normalizeText } from "../mapping/location";

/** Nombre único de la playa principal. */
export const MAIN_BEACH = "Playa Barca / Mondragó";
/** Nombres que han existido para esa misma playa y hay que fusionar. */
const MERGEABLE = ["playa barca / mondrago", "playa barca", "mondrago"];

const SANTANYI = "Cala Santanyí";
const PONTAS = "Es Pontàs";
const PONTAS_MATCH = "es pont[àa]s|pontas|santany";

/**
 * @returns `true` si en ESTA ejecución se creó por primera vez la playa Cala
 * Santanyí, o se fusionaron dos playas en una (señal de que hay que reprocesar
 * las reservas para repartirlas a su playa).
 */
export async function ensureBeachConfig(): Promise<boolean> {
  const db = await getDb();
  const orgs = await db.select().from(schema.orgs);
  let cambios = false;

  for (const org of orgs) {
    if (await mergeMainBeach(org.id, org.slug)) cambios = true;
    if (await ensureSantanyi(org.id, org.slug)) cambios = true;
  }

  return cambios;
}

// ── 1. Playa Barca + Mondragó → una sola playa ─────────────────────────

/**
 * Funde en una sola playa todas las que sean "Playa Barca" o "Mondragó". Mueve
 * sus productos, franjas, salidas y reservas a la playa superviviente, sin
 * perder ninguna reserva y sin dejar productos ni franjas duplicados.
 */
async function mergeMainBeach(orgId: string, slug: string): Promise<boolean> {
  const db = await getDb();
  const locations = await db
    .select()
    .from(schema.locations)
    .where(eq(schema.locations.orgId, orgId));
  const candidatas = locations.filter((l) => MERGEABLE.includes(normalizeText(l.name)));
  if (candidatas.length === 0) return false;

  // Sobrevive la que ya tiene el nombre bueno; si no, "Playa Barca"; si no, la
  // primera. Las demás se vacían encima de ella.
  const target =
    candidatas.find((l) => normalizeText(l.name) === normalizeText(MAIN_BEACH)) ??
    candidatas.find((l) => normalizeText(l.name) === "playa barca") ??
    candidatas[0];
  const sobrantes = candidatas.filter((l) => l.id !== target.id);

  let cambios = false;
  if (target.name !== MAIN_BEACH || target.sortOrder !== 1) {
    await db
      .update(schema.locations)
      .set({ name: MAIN_BEACH, sortOrder: 1, active: true })
      .where(eq(schema.locations.id, target.id));
    cambios = true;
  }

  for (const src of sobrantes) {
    await absorbLocation(orgId, src.id, target.id);
    await db.delete(schema.locations).where(eq(schema.locations.id, src.id));
    console.log(`[${slug}] "${src.name}" fusionada en "${MAIN_BEACH}"`);
    cambios = true;
  }
  return cambios;
}

/** Traslada TODO lo que cuelga de `srcId` a `dstId` y lo deja vacío. */
async function absorbLocation(orgId: string, srcId: string, dstId: string): Promise<void> {
  const db = await getDb();

  const [srcProducts, dstProducts] = await Promise.all([
    db
      .select()
      .from(schema.products)
      .where(and(eq(schema.products.orgId, orgId), eq(schema.products.locationId, srcId))),
    db
      .select()
      .from(schema.products)
      .where(and(eq(schema.products.orgId, orgId), eq(schema.products.locationId, dstId))),
  ]);

  for (const src of srcProducts) {
    // El "Kayak" de una playa y el de la otra eran copias del mismo producto:
    // se unifican en uno para que el cupo de la franja vuelva a ser único.
    const gemelo = dstProducts.find(
      (d) => normalizeText(d.name) === normalizeText(src.name) && d.kind === src.kind,
    );
    if (gemelo) {
      await repointProduct(orgId, src.id, gemelo.id);
      await db.delete(schema.products).where(eq(schema.products.id, src.id));
    } else {
      await db
        .update(schema.products)
        .set({ locationId: dstId })
        .where(eq(schema.products.id, src.id));
      dstProducts.push({ ...src, locationId: dstId });
    }
  }

  await mergeTimeSlots(orgId, srcId, dstId);

  // Salidas extra (sin franja de plantilla) y todo lo que aún apunte a la playa.
  await db
    .update(schema.departures)
    .set({ locationId: dstId })
    .where(and(eq(schema.departures.orgId, orgId), eq(schema.departures.locationId, srcId)));
  await db
    .update(schema.bookings)
    .set({ locationId: dstId })
    .where(and(eq(schema.bookings.orgId, orgId), eq(schema.bookings.locationId, srcId)));
  await db
    .update(schema.mappingRules)
    .set({ targetLocationId: dstId })
    .where(
      and(eq(schema.mappingRules.orgId, orgId), eq(schema.mappingRules.targetLocationId, srcId)),
    );
}

/** Todo lo que apuntaba al producto viejo pasa a apuntar al bueno. */
async function repointProduct(orgId: string, srcId: string, dstId: string): Promise<void> {
  const db = await getDb();
  await db
    .update(schema.timeSlots)
    .set({ productId: dstId })
    .where(and(eq(schema.timeSlots.orgId, orgId), eq(schema.timeSlots.productId, srcId)));
  await db
    .update(schema.departures)
    .set({ productId: dstId })
    .where(and(eq(schema.departures.orgId, orgId), eq(schema.departures.productId, srcId)));
  await db
    .update(schema.bookings)
    .set({ productId: dstId })
    .where(and(eq(schema.bookings.orgId, orgId), eq(schema.bookings.productId, srcId)));
  await db
    .update(schema.mappingRules)
    .set({ targetProductId: dstId })
    .where(and(eq(schema.mappingRules.orgId, orgId), eq(schema.mappingRules.targetProductId, srcId)));
}

/**
 * Las franjas de la playa absorbida se funden con las de la playa buena cuando
 * coinciden producto y hora: es la MISMA salida de las 10:00, no dos. Las
 * reservas de la franja duplicada se pasan a la que se queda.
 */
async function mergeTimeSlots(orgId: string, srcId: string, dstId: string): Promise<void> {
  const db = await getDb();
  const slots = await db
    .select()
    .from(schema.timeSlots)
    .where(eq(schema.timeSlots.orgId, orgId));
  const dstSlots = slots.filter((s) => s.locationId === dstId);

  for (const src of slots.filter((s) => s.locationId === srcId)) {
    const gemela = dstSlots.find(
      (d) => d.productId === src.productId && d.startTime === src.startTime,
    );
    if (!gemela) {
      await db
        .update(schema.timeSlots)
        .set({ locationId: dstId })
        .where(eq(schema.timeSlots.id, src.id));
      dstSlots.push({ ...src, locationId: dstId });
      continue;
    }
    await mergeDepartures(orgId, src.id, gemela.id, dstId);
    await db.delete(schema.timeSlots).where(eq(schema.timeSlots.id, src.id));
  }
}

/**
 * Une las salidas de dos franjas equivalentes. Cada día solo puede haber una
 * salida por franja (índice único), así que cuando el mismo día existe en las
 * dos, las reservas se juntan en una y la otra desaparece.
 */
async function mergeDepartures(
  orgId: string,
  srcSlotId: string,
  dstSlotId: string,
  dstLocationId: string,
): Promise<void> {
  const db = await getDb();
  const departures = await db
    .select()
    .from(schema.departures)
    .where(
      and(
        eq(schema.departures.orgId, orgId),
        inArray(schema.departures.timeSlotId, [srcSlotId, dstSlotId]),
      ),
    );
  const porFecha = new Map(
    departures.filter((d) => d.timeSlotId === dstSlotId).map((d) => [d.date, d]),
  );

  for (const src of departures.filter((d) => d.timeSlotId === srcSlotId)) {
    const dst = porFecha.get(src.date);
    if (!dst) {
      await db
        .update(schema.departures)
        .set({ timeSlotId: dstSlotId, locationId: dstLocationId })
        .where(eq(schema.departures.id, src.id));
      continue;
    }
    await db
      .update(schema.bookings)
      .set({ departureId: dst.id })
      .where(and(eq(schema.bookings.orgId, orgId), eq(schema.bookings.departureId, src.id)));
    // Si una de las dos estaba marcada como doble salida, la unión también.
    if (src.isDouble && !dst.isDouble) {
      await db
        .update(schema.departures)
        .set({ isDouble: true })
        .where(eq(schema.departures.id, dst.id));
    }
    await db.delete(schema.departures).where(eq(schema.departures.id, src.id));
  }
}

// ── 2. Cala Santanyí + Es Pontàs ───────────────────────────────────────

async function ensureSantanyi(orgId: string, slug: string): Promise<boolean> {
  const db = await getDb();
  let creada = false;

  let [santanyi] = await db
    .select()
    .from(schema.locations)
    .where(and(eq(schema.locations.orgId, orgId), eq(schema.locations.name, SANTANYI)));
  if (!santanyi) {
    [santanyi] = await db
      .insert(schema.locations)
      .values({ orgId, name: SANTANYI, sortOrder: 2 })
      .returning();
    creada = true;
    console.log(`[${slug}] + playa ${SANTANYI}`);
  }

  let [pontas] = await db
    .select()
    .from(schema.products)
    .where(and(eq(schema.products.orgId, orgId), eq(schema.products.name, PONTAS)));
  if (!pontas) {
    [pontas] = await db
      .insert(schema.products)
      .values({ orgId, locationId: santanyi.id, name: PONTAS, sortOrder: 4 })
      .returning();
    console.log(`[${slug}] + producto ${PONTAS}`);
  }

  const slots = await db
    .select()
    .from(schema.timeSlots)
    .where(and(eq(schema.timeSlots.orgId, orgId), eq(schema.timeSlots.productId, pontas.id)));
  if (slots.length === 0) {
    await db.insert(schema.timeSlots).values({
      orgId,
      locationId: santanyi.id,
      productId: pontas.id,
      startTime: "10:30",
      defaultCapacity: 22,
    });
    console.log(`[${slug}] + franja 10:30 (cupo 22) para ${PONTAS}`);
  }

  const rule = await db
    .select()
    .from(schema.mappingRules)
    .where(
      and(eq(schema.mappingRules.orgId, orgId), eq(schema.mappingRules.matchValue, PONTAS_MATCH)),
    );
  if (rule.length === 0) {
    await db.insert(schema.mappingRules).values({
      orgId,
      priority: 5,
      matchType: "regex",
      matchValue: PONTAS_MATCH,
      targetProductId: pontas.id,
      targetLocationId: santanyi.id,
    });
    console.log(`[${slug}] + regla de mapeo Es Pontàs`);
  }

  return creada;
}
