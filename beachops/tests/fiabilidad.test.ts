import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";

process.env.PGLITE_DIR = "memory://";
process.env.TOKEN_ENCRYPTION_KEY = "0".repeat(64);

import { getDb, schema } from "../src/server/db";
import { processRawEmail } from "../src/server/ingest/process";
import { retryFailedEmails, backoffMinutes, MAX_ATTEMPTS } from "../src/server/ingest/retry";
import { classifyUnknown } from "../src/server/parsers/registry";
import { seed } from "../scripts/seed";

function fixture(name: string): string {
  return readFileSync(path.join(__dirname, "..", "fixtures", "emails", name), "utf8");
}

let orgId: string;

beforeAll(async () => {
  orgId = (await seed()) as string;
});

/** Mete el email en la base tal cual llega, sin procesarlo. */
async function guardar(opts: {
  id: string;
  from?: string;
  subject?: string;
  html?: string;
  status?: "pending" | "failed";
  attempts?: number;
  processedAt?: Date | null;
}) {
  const db = await getDb();
  const [raw] = await db
    .insert(schema.rawEmails)
    .values({
      orgId,
      gmailMessageId: opts.id,
      fromAddress: opts.from ?? "no-reply@getyourguide.com",
      subject: opts.subject ?? "Booking",
      bodyHtml: opts.html ?? "<p>hola</p>",
      receivedAt: new Date(),
      parseStatus: opts.status ?? "pending",
      parseAttempts: opts.attempts ?? 0,
      processedAt: opts.processedAt ?? null,
    })
    .onConflictDoNothing()
    .returning();
  return raw;
}

async function estado(id: string) {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(schema.rawEmails)
    .where(and(eq(schema.rawEmails.orgId, orgId), eq(schema.rawEmails.gmailMessageId, id)));
  return row;
}

// ── Lo que más falla: mensajes tratados como reservas rotas ────────────

describe("un cliente escribiendo no es una reserva fallida", () => {
  it("una consulta con la palabra 'reserva' se ignora, no se marca como error", () => {
    // Antes bastaba con que el asunto dijera "reserva": esta consulta acababa
    // todos los días en la lista de emails con error.
    expect(
      classifyUnknown({
        fromAddress: "marta.gomez@gmail.com",
        subject: "Consulta sobre mi reserva de mañana",
        bodyHtml: "<p>Hola, ¿el kayak es apto para niños de 6 años? Gracias.</p>",
        bodyText: null,
      }),
    ).toBe("message");
  });

  it("una respuesta al buzón es un mensaje aunque lleve el localizador", () => {
    expect(
      classifyUnknown({
        fromAddress: "cliente@example.com",
        subject: "RE: Booking GYGWZAVH62MX",
        bodyHtml: "<p>Llegaremos 10 minutos tarde</p>",
        bodyText: null,
      }),
    ).toBe("message");
  });

  it("un boletín no es una reserva", () => {
    expect(
      classifyUnknown({
        fromAddress: "news@turismobalear.com",
        subject: "Novedades del verano en Mallorca",
        bodyHtml: "<p>Descubre las mejores excursiones</p>",
        bodyText: null,
      }),
    ).toBe("message");
  });
});

describe("una reserva no se pierde nunca", () => {
  it("un localizador en el asunto basta para tratarla como reserva", () => {
    expect(
      classifyUnknown({
        fromAddress: "bookings@nuevaplataforma.com",
        subject: "Confirmación ABC-12345",
        bodyHtml: "<p>Gracias</p>",
        bodyText: null,
      }),
    ).toBe("booking");
  });

  it("en el cuerpo, con sus etiquetas, también", () => {
    expect(
      classifyUnknown({
        fromAddress: "hola@agenciadeviajes.com",
        subject: "Grupo para el jueves",
        bodyHtml: "<p>Booking reference: TRV-99812</p><p>4 adults</p>",
        bodyText: null,
      }),
    ).toBe("booking");
  });

  it("un robot que habla de reservas siempre es una reserva", () => {
    expect(
      classifyUnknown({
        fromAddress: "no-reply@otraplataforma.com",
        subject: "Your reservation is confirmed",
        bodyHtml: "<p>Kayak tour</p>",
        bodyText: null,
      }),
    ).toBe("booking");
  });

  it("una fecha suelta no se confunde con un localizador", () => {
    expect(
      classifyUnknown({
        fromAddress: "ana@example.com",
        subject: "Duda 2026-08-20",
        bodyHtml: "<p>¿Hay parking cerca?</p>",
        bodyText: null,
      }),
    ).toBe("message");
  });
});

// ── Reintento automático ───────────────────────────────────────────────

describe("los emails con error se vuelven a revisar solos", () => {
  it("la espera crece con cada intento y se corta a las 24 h", () => {
    expect(backoffMinutes(1)).toBe(5);
    expect(backoffMinutes(2)).toBe(15);
    expect(backoffMinutes(3)).toBe(45);
    expect(backoffMinutes(8)).toBe(24 * 60);
  });

  it("un fallido que ya cumplió su espera se reintenta y esta vez entra", async () => {
    // Falló hace una hora (por lo que fuera). Ahora el email SÍ se puede leer.
    await guardar({
      id: "retry-1",
      subject: "Booking - S436088 - GYGRETRY0001",
      html: fixture("gyg-new.html").replace(/GYG[A-Z0-9]{6,}/g, "GYGRETRY0001"),
      status: "failed",
      attempts: 1,
      processedAt: new Date(Date.now() - 60 * 60_000),
    });

    expect(await retryFailedEmails()).toBeGreaterThan(0);

    const row = await estado("retry-1");
    expect(row.parseStatus).toBe("parsed");
    expect(row.parseAttempts).toBe(0); // al conseguirlo, la cuenta se reinicia
    expect(row.bookingId).not.toBeNull();
  });

  it("uno que acaba de fallar espera su turno", async () => {
    await guardar({
      id: "retry-2",
      subject: "Algo ilegible",
      html: "<p>Booking reference: XX-00001</p>",
      status: "failed",
      attempts: 1,
      processedAt: new Date(), // recién fallado
    });
    const antes = (await estado("retry-2")).processedAt;
    await retryFailedEmails();
    expect((await estado("retry-2")).processedAt).toEqual(antes);
  });

  it("después de 8 intentos deja de insistir: eso ya lo tiene que mirar alguien", async () => {
    await guardar({
      id: "retry-3",
      subject: "Imposible de leer",
      html: "<p>Booking reference: XX-00002</p>",
      status: "failed",
      attempts: MAX_ATTEMPTS,
      processedAt: new Date(Date.now() - 30 * 24 * 60 * 60_000),
    });
    const antes = (await estado("retry-3")).processedAt;
    await retryFailedEmails();
    expect((await estado("retry-3")).processedAt).toEqual(antes);
  });

  it("tras un despliegue se reintentan todos, sin esperas", async () => {
    await guardar({
      id: "retry-4",
      subject: "Booking - S436088 - GYGRETRY0004",
      html: fixture("gyg-new.html").replace(/GYG[A-Z0-9]{6,}/g, "GYGRETRY0004"),
      status: "failed",
      attempts: 3,
      processedAt: new Date(), // acaba de fallar: sin ignoreBackoff no tocaría
    });
    await retryFailedEmails({ ignoreBackoff: true });
    expect((await estado("retry-4")).parseStatus).toBe("parsed");
  });
});

describe("un email a medias no se queda ahí para siempre", () => {
  it("rescata el que entró y nunca llegó a procesarse (worker reiniciado)", async () => {
    const db = await getDb();
    // Así queda un email si el worker muere entre el INSERT y el proceso.
    await guardar({
      id: "pendiente-1",
      subject: "Booking - S436088 - GYGPEND00001",
      html: fixture("gyg-new.html").replace(/GYG[A-Z0-9]{6,}/g, "GYGPEND00001"),
      status: "pending",
      processedAt: null,
    });

    await retryFailedEmails();

    const row = await estado("pendiente-1");
    expect(row.parseStatus).toBe("parsed");
    const [booking] = await db
      .select()
      .from(schema.bookings)
      .where(and(eq(schema.bookings.orgId, orgId), eq(schema.bookings.externalRef, "GYGPEND00001")));
    expect(booking).toBeTruthy();
  });

  it("un email que revienta no tumba el ciclo: queda marcado y se puede reintentar", async () => {
    // 3.000 millones de adultos no caben en la columna: el INSERT explota.
    const raw = await guardar({
      id: "revienta-1",
      subject: "Booking - S436088 - GYGBOOM00001",
      html: fixture("gyg-new.html")
        .replace(/GYG[A-Z0-9]{6,}/g, "GYGBOOM00001")
        .replace("<b>2</b> x Adults", "<b>3000000000</b> x Adults"),
    });
    await expect(processRawEmail(raw)).resolves.toBeUndefined();

    const row = await estado("revienta-1");
    expect(row.parseStatus).toBe("failed");
    expect(row.parseError).toMatch(/Error inesperado/);
    expect(row.parseAttempts).toBe(1);
  });
});

describe("toda reserva leída queda contabilizada con su número", () => {
  it("ningún email dado por bueno se queda sin reserva ni sin referencia", async () => {
    const db = await getDb();
    const parsed = await db
      .select()
      .from(schema.rawEmails)
      .where(
        and(eq(schema.rawEmails.orgId, orgId), inArray(schema.rawEmails.parseStatus, ["parsed"])),
      );
    expect(parsed.length).toBeGreaterThan(0);
    for (const row of parsed) {
      expect(row.bookingId, `email ${row.subject} sin reserva`).not.toBeNull();
    }
    const bookings = await db
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.orgId, orgId));
    for (const b of bookings) {
      expect(b.externalRef, `reserva de ${b.customerName} sin referencia`).toBeTruthy();
    }
  });
});
