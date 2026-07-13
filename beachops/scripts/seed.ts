/**
 * Seed inicial: org Secret Point Mallorca con sus playas, productos,
 * franjas horarias, reglas de mapeo y el usuario propietario.
 *   npm run db:seed
 */
import { eq } from "drizzle-orm";
import { getDb, schema } from "../src/server/db";
import { runMigrations } from "../src/server/db/migrate";
import { hashPassword } from "../src/server/crypto";

export async function seed() {
  await runMigrations();
  const db = await getDb();

  const existing = await db
    .select()
    .from(schema.orgs)
    .where(eq(schema.orgs.slug, "secret-point-mallorca"));
  if (existing.length > 0) {
    console.log("La org ya existe; seed omitido.");
    return existing[0].id;
  }

  const [org] = await db
    .insert(schema.orgs)
    .values({
      name: "Secret Point Mallorca",
      slug: "secret-point-mallorca",
      settings: { lat: 39.349, lng: 3.189 }, // Mondragó, para la meteo del cuadro
    })
    .returning();

  const ownerEmail = process.env.SEED_OWNER_EMAIL ?? "owner@example.com";
  const ownerPassword = process.env.SEED_OWNER_PASSWORD ?? "cambiame";
  const [owner] = await db
    .insert(schema.users)
    .values({
      email: ownerEmail,
      name: "Propietario",
      passwordHash: hashPassword(ownerPassword),
    })
    .returning();
  await db
    .insert(schema.memberships)
    .values({ orgId: org.id, userId: owner.id, role: "owner" });

  const [mondrago] = await db
    .insert(schema.locations)
    .values({ orgId: org.id, name: "Playa Barca / Mondragó", sortOrder: 1 })
    .returning();

  const [kayak] = await db
    .insert(schema.products)
    .values({ orgId: org.id, locationId: mondrago.id, name: "Kayak", sortOrder: 1 })
    .returning();
  const [paddle] = await db
    .insert(schema.products)
    .values({ orgId: org.id, locationId: mondrago.id, name: "Paddle Surf", sortOrder: 2 })
    .returning();
  const [privada] = await db
    .insert(schema.products)
    .values({
      orgId: org.id,
      locationId: mondrago.id,
      name: "Privada",
      kind: "private",
      sortOrder: 3,
    })
    .returning();

  const slotValues = [
    { startTime: "10:00", productId: kayak.id, defaultCapacity: 12 },
    { startTime: "10:00", productId: paddle.id, defaultCapacity: 4 },
    { startTime: "12:30", productId: kayak.id, defaultCapacity: 12 },
    { startTime: "12:30", productId: paddle.id, defaultCapacity: 6 },
    { startTime: "15:00", productId: kayak.id, defaultCapacity: 12 },
    { startTime: "17:30", productId: kayak.id, defaultCapacity: 12 },
    { startTime: "18:00", productId: privada.id, defaultCapacity: 12 },
  ];
  await db.insert(schema.timeSlots).values(
    slotValues.map((s) => ({ orgId: org.id, locationId: mondrago.id, ...s })),
  );

  // Reglas de mapeo para los productos que venden hoy en GYG y Viator.
  await db.insert(schema.mappingRules).values([
    {
      orgId: org.id,
      priority: 10,
      source: "bokun_viator",
      matchType: "contains",
      matchValue: "5644751P2",
      targetProductId: kayak.id,
      targetLocationId: mondrago.id,
    },
    {
      orgId: org.id,
      priority: 20,
      matchType: "contains",
      matchValue: "Paddle Surf",
      targetProductId: paddle.id,
      targetLocationId: mondrago.id,
    },
    {
      orgId: org.id,
      priority: 30,
      matchType: "contains",
      matchValue: "Kayak",
      targetProductId: kayak.id,
      targetLocationId: mondrago.id,
    },
    {
      orgId: org.id,
      priority: 40,
      matchType: "contains",
      matchValue: "Mondragó",
      targetProductId: kayak.id,
      targetLocationId: mondrago.id,
    },
  ]);

  console.log(`Seed completado. Org: ${org.id} · Usuario: ${ownerEmail}`);
  return org.id;
}

if (process.argv[1]?.endsWith("seed.ts")) {
  seed().then(() => process.exit(0));
}
