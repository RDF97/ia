import { and, eq } from "drizzle-orm";
import { getDb, schema } from "../db";
import { RawEmail } from "../db/schema";
import { applyMappingRules, resolveTimeSlot } from "../mapping/engine";
import { detectParser, looksLikeBooking } from "../parsers/registry";
import { ParseError, ParsedBooking } from "../parsers/types";

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
    await db
      .update(schema.rawEmails)
      .set({
        detectedSource: "unknown",
        parseStatus: looksLikeBooking(email) ? "failed" : "ignored",
        parseError: looksLikeBooking(email)
          ? "Parece una reserva pero no es de una plataforma conocida"
          : null,
        processedAt: new Date(),
      })
      .where(eq(schema.rawEmails.id, raw.id));
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
    return;
  }

  const bookingId = await upsertParsedBooking(raw.orgId, parsed, raw.id, raw.subject);

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
