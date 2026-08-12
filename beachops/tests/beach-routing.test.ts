import { beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";

process.env.PGLITE_DIR = "memory://";
process.env.TOKEN_ENCRYPTION_KEY = "0".repeat(64);

import { getDb, schema } from "../src/server/db";
import { processRawEmail } from "../src/server/ingest/process";
import { getBoard } from "../src/server/board/query";
import { seed } from "../scripts/seed";
import { ensureBeachConfig } from "../src/server/config/beaches";

let orgId: string;
const DATE = "2026-08-20";

beforeAll(async () => {
  orgId = (await seed()) as string;
  await ensureBeachConfig();
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

const PRINCIPAL = "Playa Barca / Mondragó";

describe("cada reserva va a la playa que dice su email", () => {
  it("Playa Barca y Mondragó son la MISMA salida", async () => {
    await ingest("m-barca", "GYGBARCA0001", gygEmail("GYGBARCA0001", "Playa Barca"));
    await ingest("m-mondrago", "GYGMONDRA001", gygEmail("GYGMONDRA001", "Playa de Mondragó"));
    await ingest(
      "m-pontas",
      "GYGPONTAS001",
      gygEmail("GYGPONTAS001", "Cala Santanyí (Es Pontàs)", "10:30 AM"),
    );

    expect(await beachOf("GYGBARCA0001")).toBe(PRINCIPAL);
    expect(await beachOf("GYGMONDRA001")).toBe(PRINCIPAL);
    expect(await beachOf("GYGPONTAS001")).toBe("Cala Santanyí");
  });

  it("las dos caen en la misma salida de las 10:00, no en dos", async () => {
    const board = await getBoard(orgId, DATE);
    const conReservas = board.locations.filter((l) => l.paxTotal > 0);
    expect(conReservas.map((l) => l.name).sort()).toEqual(["Cala Santanyí", PRINCIPAL]);
    // Barca (2) + Mondragó (2) suman 4 pax en UNA sola salida de las 10:00.
    const principal = conReservas.find((l) => l.name === PRINCIPAL)!;
    expect(principal.paxTotal).toBe(4);
    const diez = principal.groups.filter((g) => g.startTime === "10:00" && g.paxTotal > 0);
    expect(diez).toHaveLength(1);
    expect(diez[0].paxTotal).toBe(4);
    // Santanyí sale primero y marca monitor aparte.
    expect(board.locations[0].name).toBe("Cala Santanyí");
  });

  it("el parque no se lleva una reserva de Es Pontàs", async () => {
    // El pie de los emails de GYG suele nombrar el Parc Natural de Mondragó
    // aunque la salida sea de Santanyí: manda el punto de encuentro.
    await ingest(
      "m-pontas-parque",
      "GYGPONTAS002",
      gygEmail("GYGPONTAS002", "Cala Santanyí (Es Pontàs)", "10:30 AM") +
        "<p>Descubre el Parc Natural de Mondragó con nosotros.</p>",
    );
    expect(await beachOf("GYGPONTAS002")).toBe("Cala Santanyí");
  });

  it("sin playa en el email, se queda en la playa principal (no se pierde)", async () => {
    await ingest("m-sinplaya", "GYGSINPLAYA1", gygEmail("GYGSINPLAYA1", "Mallorca"));
    expect(await beachOf("GYGSINPLAYA1")).toBe(PRINCIPAL);
  });
});

describe("la hora de la salida la manda el email", () => {
  it("una reserva de Es Pontàs a las 10:00 no se va a la franja de las 10:30", async () => {
    const db = await getDb();
    await ingest(
      "m-pontas-10",
      "GYGPONTAS010",
      gygEmail("GYGPONTAS010", "Cala Santanyí (Es Pontàs)", "10:00 AM"),
    );
    const [b] = await db
      .select()
      .from(schema.bookings)
      .where(and(eq(schema.bookings.orgId, orgId), eq(schema.bookings.externalRef, "GYGPONTAS010")));
    const [dep] = await db
      .select()
      .from(schema.departures)
      .where(eq(schema.departures.id, b.departureId!));

    expect(dep.startTime.slice(0, 5)).toBe("10:00");
    expect(dep.timeSlotId).toBeNull(); // salida propia, no la franja de las 10:30
    // Y conserva el cupo del producto (Es Pontàs son 22, no los 12 de kayak).
    expect(dep.capacityOverride).toBe(22);

    // En el cuadro sale a su hora, aparte de la de las 10:30.
    const board = await getBoard(orgId, DATE);
    const santanyi = board.locations.find((l) => l.name === "Cala Santanyí")!;
    const horas = santanyi.activeGroups.filter((g) => g.paxTotal > 0).map((g) => g.startTime);
    expect(horas).toContain("10:00");
  });
});
