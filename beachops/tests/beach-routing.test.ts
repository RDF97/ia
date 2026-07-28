import { beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";

process.env.PGLITE_DIR = "memory://";
process.env.TOKEN_ENCRYPTION_KEY = "0".repeat(64);

import { getDb, schema } from "../src/server/db";
import { processRawEmail } from "../src/server/ingest/process";
import { getBoard } from "../src/server/board/query";
import { seed } from "../scripts/seed";
import { ensureSantanyiConfig } from "../src/server/config/ensure-santanyi";

let orgId: string;
const DATE = "2026-08-20";

beforeAll(async () => {
  orgId = (await seed()) as string;
  await ensureSantanyiConfig();
});

/** Email de GYG con un punto de encuentro concreto. */
function gygEmail(ref: string, meetingPoint: string, time = "10:00 AM") {
  return `
    <h1>Mallorca: Kayak &amp; Snorkel Tour</h1>
    <p>Date: August 20, 2026 ${time}</p>
    <p>Number of participants: 2 x Adult</p>
    <p>Meeting point: ${meetingPoint}</p>
    <p>Reference number: ${ref}</p>
  `;
}

async function ingest(id: string, ref: string, html: string) {
  const db = await getDb();
  const [raw] = await db
    .insert(schema.rawEmails)
    .values({
      orgId,
      gmailMessageId: id,
      fromAddress: "no-reply@getyourguide.com",
      subject: `Booking - S436088 - ${ref}`,
      bodyHtml: html,
      receivedAt: new Date(),
    })
    .onConflictDoNothing()
    .returning();
  if (raw) await processRawEmail(raw);
}

async function beachOf(ref: string): Promise<string> {
  const db = await getDb();
  const [b] = await db
    .select()
    .from(schema.bookings)
    .where(and(eq(schema.bookings.orgId, orgId), eq(schema.bookings.externalRef, ref)));
  const [loc] = await db
    .select()
    .from(schema.locations)
    .where(eq(schema.locations.id, b.locationId!));
  return loc.name;
}

describe("cada reserva va a la playa que dice su email", () => {
  it("reparte las tres playas leyendo el punto de encuentro", async () => {
    await ingest("m-barca", "GYGBARCA0001", gygEmail("GYGBARCA0001", "Playa Barca"));
    await ingest("m-mondrago", "GYGMONDRA001", gygEmail("GYGMONDRA001", "Playa de Mondragó"));
    await ingest(
      "m-pontas",
      "GYGPONTAS001",
      gygEmail("GYGPONTAS001", "Cala Santanyí (Es Pontàs)", "10:30 AM"),
    );

    expect(await beachOf("GYGBARCA0001")).toBe("Playa Barca");
    expect(await beachOf("GYGMONDRA001")).toBe("Mondragó");
    expect(await beachOf("GYGPONTAS001")).toBe("Cala Santanyí");
  });

  it("el cuadro las muestra en tres secciones separadas", async () => {
    const board = await getBoard(orgId, DATE);
    const conReservas = board.locations.filter((l) => l.paxTotal > 0);
    expect(conReservas.map((l) => l.name).sort()).toEqual([
      "Cala Santanyí",
      "Mondragó",
      "Playa Barca",
    ]);
    // Cada playa con sus 2 pax y su propia salida.
    for (const loc of conReservas) {
      expect(loc.paxTotal).toBe(2);
      expect(loc.groups.some((g) => g.paxTotal > 0 && g.departureId)).toBe(true);
    }
    // Santanyí sale primero y marca monitor aparte.
    expect(board.locations[0].name).toBe("Cala Santanyí");
  });

  it("sin playa en el email, se queda en la playa principal (no se pierde)", async () => {
    await ingest("m-sinplaya", "GYGSINPLAYA1", gygEmail("GYGSINPLAYA1", "Mallorca"));
    expect(await beachOf("GYGSINPLAYA1")).toBe("Playa Barca");
  });
});
