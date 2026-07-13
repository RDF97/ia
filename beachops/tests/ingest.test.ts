import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

process.env.PGLITE_DIR = "memory://";
process.env.TOKEN_ENCRYPTION_KEY = "0".repeat(64);

import { getDb, schema } from "../src/server/db";
import { processRawEmail } from "../src/server/ingest/process";
import { seed } from "../scripts/seed";

function fixture(name: string): string {
  return readFileSync(path.join(__dirname, "..", "fixtures", "emails", name), "utf8");
}

let orgId: string;

async function ingest(gmailMessageId: string, from: string, subject: string, html: string) {
  const db = await getDb();
  const [raw] = await db
    .insert(schema.rawEmails)
    .values({
      orgId,
      gmailMessageId,
      fromAddress: from,
      subject,
      bodyHtml: html,
      receivedAt: new Date(),
    })
    .onConflictDoNothing()
    .returning();
  if (raw) await processRawEmail(raw);
  return raw;
}

beforeAll(async () => {
  orgId = (await seed()) as string;
});

describe("pipeline email → reserva", () => {
  it("un email de Bókun crea la reserva mapeada a producto/playa/franja", async () => {
    const db = await getDb();
    await ingest(
      "msg-bokun-1",
      "no-reply@bokun.io",
      "New booking: Sat 11.Jul '26 @ 09:30 (SEC-T137216508) Ext. booking ref: 1421195303",
      fixture("bokun-new.html"),
    );
    const rows = await db
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.externalRef, "VIA-96827518"));
    expect(rows).toHaveLength(1);
    const b = rows[0];
    expect(b.status).toBe("confirmed");
    expect(b.paxAdults).toBe(2);
    expect(b.productId).not.toBeNull();
    // 09:30 de Viator se asigna a la salida real de las 10:00
    expect(b.departureId).not.toBeNull();
    const [dep] = await db
      .select()
      .from(schema.departures)
      .where(eq(schema.departures.id, b.departureId!));
    expect(dep.startTime.slice(0, 5)).toBe("10:00");
  });

  it("reprocesar el mismo email no duplica la reserva (idempotencia)", async () => {
    const db = await getDb();
    const [raw] = await db
      .select()
      .from(schema.rawEmails)
      .where(eq(schema.rawEmails.gmailMessageId, "msg-bokun-1"));
    await processRawEmail(raw);
    await processRawEmail(raw);
    const rows = await db
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.externalRef, "VIA-96827518"));
    expect(rows).toHaveLength(1);
  });

  it("un email de GYG crea la reserva con país derivado del teléfono", async () => {
    const db = await getDb();
    await ingest(
      "msg-gyg-1",
      "no-reply@getyourguide.com",
      "Booking - S436088 - GYGTESTFRQ75",
      fixture("gyg-new.html"),
    );
    const rows = await db
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.externalRef, "GYGTESTFRQ75"));
    expect(rows).toHaveLength(1);
    expect(rows[0].customerCountry).toBe("ES");
    expect(rows[0].status).toBe("confirmed");
    expect(rows[0].activityDate).toBe("2026-07-11");
  });

  it("una cancelación marca la reserva como cancelada sin borrarla", async () => {
    const db = await getDb();
    await ingest(
      "msg-gyg-2",
      "no-reply@getyourguide.com",
      "Booking cancelled - GYGTESTFRQ75",
      fixture("gyg-cancelled.html"),
    );
    const rows = await db
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.externalRef, "GYGTESTFRQ75"));
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("cancelled");
    expect(rows[0].cancelledAt).not.toBeNull();
  });

  it("una reserva con hora fuera de la plantilla crea una salida extra y queda confirmada", async () => {
    const db = await getDb();
    // 20:15 no existe en la plantilla (ni con tolerancia de 30 min)
    await ingest(
      "msg-bokun-hora-rara",
      "no-reply@bokun.io",
      "New booking: Sun 12.Jul '26 @ 20:15 (SEC-T999999999) Ext. booking ref: 555",
      fixture("bokun-new.html")
        .replace("Sat 11.Jul '26 @ 09:30", "Sun 12.Jul '26 @ 20:15")
        .replace("VIA-96827518", "VIA-HORARARA1"),
    );
    const rows = await db
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.activityDate, "2026-07-12"));
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("confirmed");
    expect(rows[0].departureId).not.toBeNull();
    const [dep] = await db
      .select()
      .from(schema.departures)
      .where(eq(schema.departures.id, rows[0].departureId!));
    expect(dep.timeSlotId).toBeNull(); // salida ad-hoc
    expect(dep.startTime.slice(0, 5)).toBe("20:15");
    expect(dep.capacityOverride).toBe(12);
  });

  it("un email irrelevante se ignora sin crear nada", async () => {
    const db = await getDb();
    await ingest("msg-spam-1", "newsletter@example.com", "Ofertas de verano", "<p>spam</p>");
    const [raw] = await db
      .select()
      .from(schema.rawEmails)
      .where(eq(schema.rawEmails.gmailMessageId, "msg-spam-1"));
    expect(raw.parseStatus).toBe("ignored");
  });
});
