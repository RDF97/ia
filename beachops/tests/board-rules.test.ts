import { describe, expect, it, beforeAll } from "vitest";
import { eq } from "drizzle-orm";

process.env.PGLITE_DIR = "memory://";
process.env.TOKEN_ENCRYPTION_KEY = "0".repeat(64);

import {
  capacityHex,
  capacityLevel,
  channelBadge,
  computeCashAmount,
  isCashChannel,
  isSantanyi,
  needsSplit,
  THRESHOLD_HEX,
} from "../src/server/board/rules";
import { getDb, schema } from "../src/server/db";
import { ensureDeparture } from "../src/server/ingest/process";
import { getBoard } from "../src/server/board/query";
import { seed } from "../scripts/seed";

describe("reglas de negocio (puras)", () => {
  it("umbral de color por nº de personas (§3.5)", () => {
    expect(capacityLevel(0)).toBe("green");
    expect(capacityLevel(9)).toBe("green");
    expect(capacityLevel(10)).toBe("amber");
    expect(capacityLevel(15)).toBe("amber");
    expect(capacityLevel(16)).toBe("red");
    expect(capacityHex(9)).toBe(THRESHOLD_HEX.green);
    expect(capacityHex(12)).toBe(THRESHOLD_HEX.amber);
    expect(capacityHex(20)).toBe(THRESHOLD_HEX.red);
  });

  it("≥16 personas obliga a dividir en varias salidas", () => {
    expect(needsSplit(15)).toBe(false);
    expect(needsSplit(16)).toBe(true);
  });

  it("caja: tarifa por canal (§3.2)", () => {
    // Directa/WhatsApp/Instagram/Privada 40/20
    expect(computeCashAmount("Directa", 2, 0)).toBe(80);
    expect(computeCashAmount("WhatsApp", 2, 1)).toBe(100);
    expect(computeCashAmount("Instagram", 1, 0)).toBe(40);
    expect(computeCashAmount("Privada", 3, 0)).toBe(120);
    // Hotel (vale ROIG) 45/25
    expect(computeCashAmount("Hotel", 1, 1)).toBe(70);
    expect(computeCashAmount("Hotel", 2, 0)).toBe(90);
  });

  it("caja: GYG/Viator/Freedome nunca cobran en playa", () => {
    expect(isCashChannel("GetYourGuide")).toBe(false);
    expect(isCashChannel("Viator")).toBe(false);
    expect(isCashChannel("Freedome")).toBe(false);
    expect(computeCashAmount("GetYourGuide", 4, 0)).toBeNull();
    expect(isCashChannel("Hotel")).toBe(true);
  });

  it("Santanyí / Es Pontàs se detecta por playa o producto", () => {
    expect(isSantanyi("Cala Santanyí", "Es Pontàs")).toBe(true);
    expect(isSantanyi("Playa Barca / Mondragó", "Kayak")).toBe(false);
    expect(isSantanyi(null, "Es Pontas")).toBe(true);
  });

  it("badge por canal usa el color fijo del estándar", () => {
    expect(channelBadge("GetYourGuide").label).toBe("GYG");
    expect(channelBadge(null, "bokun_viator").label).toBe("Viator");
    expect(channelBadge("Freedome").fg).toBe("#00695C");
    expect(channelBadge("Hotel").label).toBe("Hotel");
  });
});

describe("getBoard con las reglas del instructivo", () => {
  let orgId: string;
  const DATE = "2026-08-15";

  beforeAll(async () => {
    orgId = (await seed()) as string;
    const db = await getDb();
    const slots = await db
      .select()
      .from(schema.timeSlots)
      .where(eq(schema.timeSlots.orgId, orgId));
    const products = await db
      .select()
      .from(schema.products)
      .where(eq(schema.products.orgId, orgId));
    const prod = (name: string) => products.find((p) => p.name === name)!;
    const kayak10 = slots.find(
      (s) => s.startTime.startsWith("10:00") && s.productId === prod("Kayak").id,
    )!;
    const pontas = slots.find((s) => s.productId === prod("Es Pontàs").id)!;

    const depKayak = await ensureDeparture(orgId, kayak10.id, DATE);
    const depPontas = await ensureDeparture(orgId, pontas.id, DATE);

    await db.insert(schema.bookings).values([
      // GYG (plataforma, fuera de caja) — 6 pax
      {
        orgId,
        departureId: depKayak,
        source: "getyourguide",
        channel: "GetYourGuide",
        externalRef: "GYG-BRD-1",
        activityDate: DATE,
        activityTime: kayak10.startTime,
        productId: kayak10.productId,
        locationId: kayak10.locationId,
        paxAdults: 6,
        paymentKind: "platform",
      },
      // Hotel efectivo — 1 ad + 1 niño = 70 €
      {
        orgId,
        departureId: depKayak,
        source: "manual",
        channel: "Hotel",
        externalRef: "HOTEL-BRD-1",
        activityDate: DATE,
        activityTime: kayak10.startTime,
        productId: kayak10.productId,
        locationId: kayak10.locationId,
        paxAdults: 1,
        paxChildren: 1,
        customerName: "Hotel Roig",
        paymentKind: "cash",
        cashAmount: "70.00",
        cashConfirmed: true,
      },
      // Es Pontàs (Cala Santanyí) — 4 pax, monitor aparte
      {
        orgId,
        departureId: depPontas,
        source: "manual",
        channel: "WhatsApp",
        externalRef: "WA-PONTAS-1",
        activityDate: DATE,
        activityTime: pontas.startTime,
        productId: pontas.productId,
        locationId: pontas.locationId,
        paxAdults: 4,
        customerName: "Grupo Pontàs",
        paymentKind: "cash",
        cashAmount: "160.00",
        cashConfirmed: true,
      },
    ]);
    await db.insert(schema.cashEntries).values([
      { orgId, date: DATE, concept: "Hotel", amount: "70.00", confirmed: true },
      { orgId, date: DATE, concept: "WhatsApp Pontàs", amount: "160.00", confirmed: true },
    ]);
  });

  it("Cala Santanyí aparece primero y marca monitor aparte", async () => {
    const board = await getBoard(orgId, DATE);
    expect(board.locations[0].isSantanyi).toBe(true);
    const pontasGroup = board.locations[0].groups.find((g) => g.paxTotal > 0)!;
    expect(pontasGroup.needsMonitor).toBe(true);
    expect(pontasGroup.paxTotal).toBe(4);
  });

  it("la caja suma solo efectivo (Hotel+WhatsApp), no GYG", async () => {
    const board = await getBoard(orgId, DATE);
    expect(board.cashTotal).toBe(230); // 70 + 160, GYG fuera
  });

  it("el gráfico suma personas por hora", async () => {
    const board = await getBoard(orgId, DATE);
    const bar10 = board.chart.find((b) => b.hora === "10:00")!;
    expect(bar10.pax).toBe(8); // 6 GYG + 2 Hotel
    expect(board.resumen.santanyi).toBe(4);
  });
});
