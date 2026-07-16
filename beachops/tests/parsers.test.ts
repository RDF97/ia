import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseBokunDate, parseGygDate } from "../src/server/parsers/dates";
import { parsePhone } from "../src/server/parsers/phone";
import { detectParser } from "../src/server/parsers/registry";
import { gygParser } from "../src/server/parsers/gyg";
import { bokunParser } from "../src/server/parsers/bokun";

function fixture(name: string): string {
  return readFileSync(path.join(__dirname, "..", "fixtures", "emails", name), "utf8");
}

const gygNew = {
  fromAddress: "no-reply@getyourguide.com",
  subject: "Booking - S436088 - GYGTESTFRQ75",
  bodyHtml: fixture("gyg-new.html"),
};

const gygCancelled = {
  fromAddress: "no-reply@getyourguide.com",
  subject: "Booking cancelled - GYGTESTFRQ75",
  bodyHtml: fixture("gyg-cancelled.html"),
};

const bokunNew = {
  fromAddress: "Bókun Notifications <no-reply@bokun.io>",
  subject: "New booking: Sat 11.Jul '26 @ 09:30 (SEC-T137216508) Ext. booking ref: 1421195303",
  bodyHtml: fixture("bokun-new.html"),
};

const bokunCancelled = {
  fromAddress: "Bókun Notifications <no-reply@bokun.io>",
  subject: "Cancelled booking: Sat 11.Jul '26 @ 09:30 (SEC-T137216508)",
  bodyHtml: fixture("bokun-cancelled.html"),
};

describe("fechas", () => {
  it("parsea fechas GYG en-US", () => {
    expect(parseGygDate("July 11, 2026 12:30 PM")).toEqual({ date: "2026-07-11", time: "12:30" });
    expect(parseGygDate("March 5, 2027 9:00 AM")).toEqual({ date: "2027-03-05", time: "09:00" });
    expect(parseGygDate("December 1, 2026 12:00 AM")).toEqual({ date: "2026-12-01", time: "00:00" });
  });
  it("parsea fechas Bókun", () => {
    expect(parseBokunDate("Sat 11.Jul '26 @ 09:30")).toEqual({ date: "2026-07-11", time: "09:30" });
    expect(parseBokunDate("Mon 2.Nov '26 @ 15:00")).toEqual({ date: "2026-11-02", time: "15:00" });
  });
});

describe("teléfonos", () => {
  it("deriva el país del prefijo", () => {
    expect(parsePhone("+34600123456").country).toBe("ES");
    expect(parsePhone("+447497882152").country).toBe("GB");
    expect(parsePhone("US+1 2105550000").country).toBe("US");
  });
});

describe("detección de plataforma", () => {
  it("detecta GYG y Bókun por el remitente", () => {
    expect(detectParser(gygNew)?.source).toBe("getyourguide");
    expect(detectParser(bokunNew)?.source).toBe("bokun_viator");
    expect(detectParser({ fromAddress: "spam@example.com", subject: "hola", bodyHtml: "" })).toBeNull();
  });
});

describe("parser GetYourGuide", () => {
  it("parsea una reserva nueva", () => {
    const parsed = gygParser.parse(gygNew);
    expect(parsed.externalRef).toBe("GYGTESTFRQ75");
    expect(parsed.activityDate).toBe("2026-07-11");
    expect(parsed.activityTime).toBe("12:30");
    expect(parsed.paxAdults).toBe(2);
    expect(parsed.paxChildren).toBe(0);
    expect(parsed.customerName).toBe("Ana Torres");
    expect(parsed.customerEmail).toBe("customer-abc123@reply.getyourguide.com");
    expect(parsed.customerPhone).toBe("+34600123456");
    expect(parsed.customerCountry).toBe("ES");
    expect(parsed.customerLanguage).toBe("Spanish");
    expect(parsed.priceAmount).toBe("94.00");
    expect(parsed.rawProductName).toContain("Kayak and Paddle Surf");
    expect(parsed.kind).toBe("new");
  });
  it("clasifica cancelaciones", () => {
    expect(gygParser.classify(gygCancelled)).toBe("cancellation");
    const parsed = gygParser.parse(gygCancelled);
    expect(parsed.kind).toBe("cancellation");
    expect(parsed.externalRef).toBe("GYGTESTFRQ75");
  });

  it("cancelación con referencia solo en el asunto y sin fecha en el cuerpo", () => {
    const parsed = gygParser.parse({
      fromAddress: "GetYourGuide <do-not-reply@getyourguide.com>",
      subject: "A booking has been canceled - S436088 - GYGSOLOASUNTO",
      bodyHtml: "<p>Open the app to see details</p>",
    });
    expect(parsed.kind).toBe("cancellation");
    expect(parsed.externalRef).toBe("GYGSOLOASUNTO");
    expect(parsed.activityDate).toBeUndefined();
  });

  it("reserva nueva con cuerpo en texto plano (sin HTML)", () => {
    const parsed = gygParser.parse({
      fromAddress: "GetYourGuide <do-not-reply@getyourguide.com>",
      subject: "Booking - S436088 - GYGTEXTONLY1",
      bodyHtml: null,
      bodyText:
        "Reference number GYGTEXTONLY1\nDate July 20, 2026 10:00 AM\n2 x Adults (Age 10 - 99)\nPrice € 90.00",
    });
    expect(parsed.externalRef).toBe("GYGTEXTONLY1");
    expect(parsed.activityDate).toBe("2026-07-20");
    expect(parsed.paxAdults).toBe(2);
  });

  it("mensajes de clientes y reseñas se clasifican como message/other", () => {
    expect(
      gygParser.classify({
        fromAddress: '"Sandra Frick via GetYourGuide" <customer-x@reply.getyourguide.com>',
        subject: "URGENT (directions): Sandra Frick has messaged you",
        bodyHtml: "<p>Where do we meet?</p>",
      }),
    ).toBe("message");
    expect(
      gygParser.classify({
        fromAddress: "GetYourGuide Review <do-not-reply@getyourguide.com>",
        subject: "You have a new review on GetYourGuide - 5 stars",
        bodyHtml: "<p>Great tour</p>",
      }),
    ).toBe("other");
  });
});

describe("parser Bókun/Viator", () => {
  it("parsea una reserva nueva", () => {
    const parsed = bokunParser.parse(bokunNew);
    expect(parsed.externalRef).toBe("VIA-96827518");
    expect(parsed.externalRefSecondary).toBe("SEC-T137216508");
    expect(parsed.activityDate).toBe("2026-07-11");
    expect(parsed.activityTime).toBe("09:30");
    expect(parsed.paxAdults).toBe(2);
    expect(parsed.rawProductName).toBe(
      "Kayaking and snorkeling in the Mondragó Natural Park in Mallorca",
    );
    expect(parsed.externalProductCode).toBe("5644751P2");
    expect(parsed.customerName).toBe("Jane Doe");
    expect(parsed.customerPhone).toBe("+12105550000");
    expect(parsed.customerCountry).toBe("US");
    expect(parsed.channel).toBe("Viator.com");
    expect(parsed.priceAmount).toBe("78.0");
    expect(parsed.priceCurrency).toBe("EUR");
    expect(parsed.kind).toBe("new");
  });
  it("clasifica cancelaciones", () => {
    expect(bokunParser.classify(bokunCancelled)).toBe("cancellation");
  });
});
