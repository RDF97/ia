import { beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";

process.env.PGLITE_DIR = "memory://";
process.env.TOKEN_ENCRYPTION_KEY = "0".repeat(64);

import { getDb, schema } from "../src/server/db";
import { processRawEmail } from "../src/server/ingest/process";
import { seed } from "../scripts/seed";

let orgId: string;
const REF = "GYGNOTA00001";

beforeAll(async () => {
  orgId = (await seed()) as string;
});

const HTML = `
  <h1>Mallorca: Kayak Tour</h1>
  <p>Date: September 3, 2026 10:00 AM</p>
  <p>Number of participants: 2 x Adult</p>
  <p>Main customer: Nadia Ferrer</p>
  <p>Reference number: ${REF}</p>
`;

async function ingest(id: string) {
  const db = await getDb();
  const [raw] = await db
    .insert(schema.rawEmails)
    .values({
      orgId,
      gmailMessageId: id,
      fromAddress: "no-reply@getyourguide.com",
      subject: `Booking - S436088 - ${REF}`,
      bodyHtml: HTML,
      receivedAt: new Date(),
    })
    .onConflictDoNothing()
    .returning();
  if (raw) await processRawEmail(raw);
  return raw;
}

describe("notas del equipo", () => {
  it("la nota escrita a mano NO se pierde al reprocesar el email", async () => {
    const db = await getDb();
    await ingest("msg-nota-1");

    // El monitor anota algo a mano
    await db
      .update(schema.bookings)
      .set({ staffNotes: "Lleva niño pequeño, chaleco talla S" })
      .where(and(eq(schema.bookings.orgId, orgId), eq(schema.bookings.externalRef, REF)));

    // Se reprocesa el email (lo hace el botón "Reprocesar reservas")
    const [raw] = await db
      .select()
      .from(schema.rawEmails)
      .where(eq(schema.rawEmails.gmailMessageId, "msg-nota-1"));
    await processRawEmail(raw);
    await processRawEmail(raw);

    const [b] = await db
      .select()
      .from(schema.bookings)
      .where(and(eq(schema.bookings.orgId, orgId), eq(schema.bookings.externalRef, REF)));
    expect(b.staffNotes).toBe("Lleva niño pequeño, chaleco talla S");
    // …y el resto de la reserva sigue correcto
    expect(b.customerName).toBe("Nadia Ferrer");
    expect(b.paxAdults).toBe(2);
  });
});
