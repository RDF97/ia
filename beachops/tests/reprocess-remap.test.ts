import { beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";

process.env.PGLITE_DIR = "memory://";
process.env.TOKEN_ENCRYPTION_KEY = "0".repeat(64);

import { getDb, schema } from "../src/server/db";
import { runMigrations } from "../src/server/db/migrate";
import { processRawEmail } from "../src/server/ingest/process";
import { ensureSantanyiConfig } from "../src/server/config/ensure-santanyi";

let orgId: string;

// Escenario "producción antes del parche": solo Mondragó/Kayak, sin Cala Santanyí.
beforeAll(async () => {
  await runMigrations();
  const db = await getDb();
  const [org] = await db
    .insert(schema.orgs)
    .values({ name: "Org Sin Santanyí", slug: "org-sin-santanyi" })
    .returning();
  orgId = org.id;
  const [mondrago] = await db
    .insert(schema.locations)
    .values({ orgId, name: "Playa Barca / Mondragó", sortOrder: 1 })
    .returning();
  const [kayak] = await db
    .insert(schema.products)
    .values({ orgId, locationId: mondrago.id, name: "Kayak", sortOrder: 1 })
    .returning();
  await db
    .insert(schema.timeSlots)
    .values({ orgId, locationId: mondrago.id, productId: kayak.id, startTime: "10:00", defaultCapacity: 12 });
  await db.insert(schema.mappingRules).values({
    orgId,
    priority: 30,
    matchType: "contains",
    matchValue: "Kayak",
    targetProductId: kayak.id,
    targetLocationId: mondrago.id,
  });
});

const ES_PONTAS_HTML = `
  <h1>Mallorca: Sea Kayak Tour to Es Pontàs</h1>
  <p>Date: July 25, 2026 10:00 AM</p>
  <p>Number of participants: 2 x Adult</p>
`;

async function ingestEsPontas() {
  const db = await getDb();
  const [raw] = await db
    .insert(schema.rawEmails)
    .values({
      orgId,
      gmailMessageId: "msg-espontas-1",
      fromAddress: "no-reply@getyourguide.com",
      subject: "Booking - S436088 - GYGESPONTAS1",
      bodyHtml: ES_PONTAS_HTML,
      receivedAt: new Date(),
    })
    .onConflictDoNothing()
    .returning();
  if (raw) await processRawEmail(raw);
}

describe("reprocesar mueve Es Pontàs a Cala Santanyí", () => {
  it("sin la config, la reserva de Es Pontàs cae en Mondragó", async () => {
    await ingestEsPontas();
    const db = await getDb();
    const [b] = await db
      .select()
      .from(schema.bookings)
      .where(and(eq(schema.bookings.orgId, orgId), eq(schema.bookings.externalRef, "GYGESPONTAS1")));
    expect(b).toBeTruthy();
    const [loc] = await db
      .select()
      .from(schema.locations)
      .where(eq(schema.locations.id, b.locationId!));
    expect(loc.name).toBe("Playa Barca / Mondragó");
  });

  it("tras ensureSantanyiConfig + reprocesar, se mueve a Cala Santanyí / Es Pontàs", async () => {
    await ensureSantanyiConfig();
    const db = await getDb();
    // Reprocesar el mismo email (como hace el botón "Reprocesar reservas").
    const [raw] = await db
      .select()
      .from(schema.rawEmails)
      .where(eq(schema.rawEmails.gmailMessageId, "msg-espontas-1"));
    await processRawEmail(raw);

    const [b] = await db
      .select()
      .from(schema.bookings)
      .where(and(eq(schema.bookings.orgId, orgId), eq(schema.bookings.externalRef, "GYGESPONTAS1")));
    const [loc] = await db
      .select()
      .from(schema.locations)
      .where(eq(schema.locations.id, b.locationId!));
    const [prod] = await db
      .select()
      .from(schema.products)
      .where(eq(schema.products.id, b.productId!));
    expect(loc.name).toBe("Cala Santanyí");
    expect(prod.name).toBe("Es Pontàs");
    expect(b.departureId).not.toBeNull();
  });
});
