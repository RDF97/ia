import { and, eq, isNull } from "drizzle-orm";
import { getDb, schema } from "../db";
import { RawEmail, TimeSlot } from "../db/schema";
import { applyMappingRules, resolveTimeSlot } from "../mapping/engine";
import { detectParser, looksLikeBooking } from "../parsers/registry";
import { ParseError, ParsedBooking } from "../parsers/types";
import { sendPushToOrg } from "../push";

/** Solo se notifica lo reciente: el backfill inicial no debe disparar avisos. */
function isRecent(receivedAt: Date | null): boolean {
  return receivedAt != null && Date.now() - receivedAt.getTime() < 6 * 60 * 60 * 1000;
}

/**
 * Procesa un email crudo: detecta la plataforma, parsea la reserva, aplica el
 * mapeo a producto/playa/franja y hace upsert de la reserva. Idempotente:
 * reprocesar el mismo email o recibir un duplicado actualiza, nunca duplica.
 */
export async function processRawEmail(raw: RawEmail): Promise<void> {
  const db = await getDb();
  const email = {
    fromAddress: raw.fromAddress,
    subject: raw.subject,
    bodyHtml: raw.bodyHtml,
    bodyText: raw.bodyText,
  };

  const parser = detectParser(email);
  if (!parser) {
    const failed = looksLikeBooking(email);
    await db
      .update(schema.rawEmails)
      .set({
        detectedSource: "unknown",
        parseStatus: failed ? "failed" : "ignored",
        parseError: failed
          ? "Parece una reserva pero no es de una plataforma conocida"
          : null,
        processedAt: new Date(),
      })
      .where(eq(schema.rawEmails.id, raw.id));
    if (failed && isRecent(raw.receivedAt)) {
      await sendPushToOrg(raw.orgId, {
        title: "⚠ Email sin procesar",
        body: raw.subject ?? "Un email de reserva no se pudo interpretar",
        url: "/emails",
        tag: `email-${raw.id}`,
      });
    }
    return;
  }

  let parsed: ParsedBooking;
  try {
    parsed = parser.parse(email);
  } catch (err) {
    const message =
      err instanceof ParseError ? `Campo "${err.field}": ${err.message}` : String(err);
    await db
      .update(schema.rawEmails)
      .set({
        detectedSource: parser.source,
        detectedKind: parser.classify(email),
        parseStatus: "failed",
        parseError: message,
        processedAt: new Date(),
      })
      .where(eq(schema.rawEmails.id, raw.id));
    if (isRecent(raw.receivedAt)) {
      await sendPushToOrg(raw.orgId, {
        title: "⚠ Email sin procesar",
        body: raw.subject ?? message,
        url: "/emails",
        tag: `email-${raw.id}`,
      });
    }
    return;
  }

  const bookingId = await upsertParsedBooking(raw.orgId, parsed, raw.id, raw.subject);

  if (isRecent(raw.receivedAt)) {
    await notifyBookingEvent(raw.orgId, parsed, bookingId);
  }

  await db
    .update(schema.rawEmails)
    .set({
      detectedSource: parser.source,
      detectedKind: parsed.kind,
      parseStatus: "parsed",
      parseError: null,
      parsedPayload: parsed,
      bookingId,
      processedAt: new Date(),
    })
    .where(eq(schema.rawEmails.id, raw.id));
}

/** Upsert de la reserva parseada. Devuelve el id de la reserva. */
export async function upsertParsedBooking(
  orgId: string,
  parsed: ParsedBooking,
  sourceEmailId: string | null,
  subject: string | null,
): Promise<string> {
  const db = await getDb();

  // Mapeo → producto/playa; franja por hora parseada (o forzada por la regla).
  const rules = await db
    .select()
    .from(schema.mappingRules)
    .where(eq(schema.mappingRules.orgId, orgId));
  const target = applyMappingRules(rules, parsed, subject);

  let departureId: string | null = null;
  let productId: string | null = null;
  let locationId: string | null = null;

  if (target) {
    productId = target.productId;
    locationId = target.locationId;
    const slots = await db
      .select()
      .from(schema.timeSlots)
      .where(eq(schema.timeSlots.orgId, orgId));
    const slot = target.timeSlotId
      ? slots.find((s) => s.id === target.timeSlotId) ?? null
      : resolveTimeSlot(slots, target.locationId, target.productId, parsed.activityTime);
    if (slot) {
      departureId = await ensureDeparture(orgId, slot.id, parsed.activityDate);
    } else if (parsed.activityTime) {
      // Hora fuera de la plantilla: se acepta igualmente creando una
      // salida "extra" para ese día a esa hora.
      departureId = await ensureAdHocDeparture(
        orgId,
        parsed.activityDate,
        parsed.activityTime,
        target.productId,
        target.locationId,
        slots,
      );
    }
  }

  const isCancellation = parsed.kind === "cancellation";
  const status = isCancellation
    ? ("cancelled" as const)
    : target && departureId
      ? ("confirmed" as const)
      : ("pending_review" as const);

  const values = {
    orgId,
    departureId,
    source: parsed.source,
    channel: parsed.channel,
    externalRef: parsed.externalRef,
    externalRefSecondary: parsed.externalRefSecondary,
    status,
    activityDate: parsed.activityDate,
    activityTime: parsed.activityTime,
    productId,
    locationId,
    rawProductName: parsed.rawProductName,
    paxAdults: parsed.paxAdults,
    paxChildren: parsed.paxChildren,
    customerName: parsed.customerName,
    customerEmail: parsed.customerEmail,
    customerPhone: parsed.customerPhone,
    customerCountry: parsed.customerCountry,
    customerLanguage: parsed.customerLanguage,
    priceAmount: parsed.priceAmount,
    priceCurrency: parsed.priceCurrency,
    paymentKind: "platform" as const,
    notes: parsed.notes,
    sourceEmailId,
    cancelledAt: isCancellation ? new Date() : null,
    updatedAt: new Date(),
  };

  if (isCancellation) {
    // Una cancelación solo debe tocar el estado de la reserva existente
    // (si no existe, se crea ya cancelada para dejar constancia).
    const existing = await db
      .select({ id: schema.bookings.id })
      .from(schema.bookings)
      .where(
        and(
          eq(schema.bookings.orgId, orgId),
          eq(schema.bookings.source, parsed.source),
          eq(schema.bookings.externalRef, parsed.externalRef),
        ),
      );
    if (existing.length > 0) {
      await db
        .update(schema.bookings)
        .set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.bookings.id, existing[0].id));
      return existing[0].id;
    }
  }

  const inserted = await db
    .insert(schema.bookings)
    .values(values)
    .onConflictDoUpdate({
      target: [schema.bookings.orgId, schema.bookings.source, schema.bookings.externalRef],
      set: values,
    })
    .returning({ id: schema.bookings.id });
  return inserted[0].id;
}

/** Notifica alta/cancelación/modificación y, si procede, la sobre-reserva. */
async function notifyBookingEvent(
  orgId: string,
  parsed: ParsedBooking,
  bookingId: string,
): Promise<void> {
  const db = await getDb();
  const pax = parsed.paxAdults + parsed.paxChildren;
  const when = `${parsed.activityDate}${parsed.activityTime ? ` · ${parsed.activityTime}` : ""}`;
  const who = parsed.customerName ?? parsed.externalRef;
  const url = `/cuadro/${parsed.activityDate}`;

  const titles = {
    new: `🛶 Nueva reserva — ${parsed.channel}`,
    cancellation: `✕ Reserva cancelada — ${parsed.channel}`,
    amendment: `✎ Reserva modificada — ${parsed.channel}`,
    other: null,
  } as const;
  const title = titles[parsed.kind];
  if (!title) return;

  await sendPushToOrg(orgId, {
    title,
    body: `${pax} pax · ${who} · ${when}`,
    url,
    tag: `booking-${bookingId}`,
  });

  // ¿La franja ha quedado sobre-reservada tras esta alta?
  if (parsed.kind !== "new") return;
  const [booking] = await db
    .select()
    .from(schema.bookings)
    .where(eq(schema.bookings.id, bookingId));
  if (!booking?.departureId) return;
  const [departure] = await db
    .select()
    .from(schema.departures)
    .where(eq(schema.departures.id, booking.departureId));
  const slot = departure.timeSlotId
    ? (
        await db
          .select()
          .from(schema.timeSlots)
          .where(eq(schema.timeSlots.id, departure.timeSlotId))
      )[0]
    : null;
  const siblings = await db
    .select()
    .from(schema.bookings)
    .where(
      and(
        eq(schema.bookings.orgId, orgId),
        eq(schema.bookings.departureId, departure.id),
      ),
    );
  const occupied = siblings
    .filter((b) => b.status !== "cancelled")
    .reduce((n, b) => n + b.paxAdults + b.paxChildren, 0);
  const capacity = departure.capacityOverride ?? slot?.defaultCapacity ?? 12;
  if (occupied > capacity) {
    await sendPushToOrg(orgId, {
      title: `🔴 Sobre-reserva ${departure.startTime.slice(0, 5)}`,
      body: `${occupied}/${capacity} pax el ${departure.date} — dividir, mover o doble salida`,
      url,
      tag: `overbook-${departure.id}`,
    });
  }
}

/**
 * Salida "extra" fuera de la plantilla (fecha+hora+producto). La capacidad
 * se hereda de la franja más grande del mismo producto (12 si no hay).
 */
export async function ensureAdHocDeparture(
  orgId: string,
  date: string,
  startTime: string,
  productId: string,
  locationId: string,
  slots: TimeSlot[],
): Promise<string> {
  const db = await getDb();
  const time = startTime.length === 5 ? `${startTime}:00` : startTime;
  const existing = await db
    .select({ id: schema.departures.id })
    .from(schema.departures)
    .where(
      and(
        eq(schema.departures.orgId, orgId),
        eq(schema.departures.date, date),
        eq(schema.departures.startTime, time),
        eq(schema.departures.productId, productId),
        isNull(schema.departures.timeSlotId),
      ),
    );
  if (existing.length > 0) return existing[0].id;

  const capacity = Math.max(
    12,
    ...slots.filter((s) => s.productId === productId && s.active).map((s) => s.defaultCapacity),
  );
  const [row] = await db
    .insert(schema.departures)
    .values({
      orgId,
      timeSlotId: null,
      locationId,
      productId,
      date,
      startTime: time,
      capacityOverride: capacity,
      notes: "Salida extra creada automáticamente (hora fuera de la plantilla)",
    })
    .returning({ id: schema.departures.id });
  return row.id;
}

/** Crea (si no existe) la salida materializada franja+fecha y devuelve su id. */
export async function ensureDeparture(
  orgId: string,
  timeSlotId: string,
  date: string,
): Promise<string> {
  const db = await getDb();
  const slot = (
    await db.select().from(schema.timeSlots).where(eq(schema.timeSlots.id, timeSlotId))
  )[0];
  const inserted = await db
    .insert(schema.departures)
    .values({
      orgId,
      timeSlotId,
      locationId: slot.locationId,
      productId: slot.productId,
      date,
      startTime: slot.startTime,
    })
    .onConflictDoNothing()
    .returning({ id: schema.departures.id });
  if (inserted.length > 0) return inserted[0].id;
  const existing = await db
    .select({ id: schema.departures.id })
    .from(schema.departures)
    .where(
      and(
        eq(schema.departures.orgId, orgId),
        eq(schema.departures.date, date),
        eq(schema.departures.timeSlotId, timeSlotId),
      ),
    );
  return existing[0].id;
}
