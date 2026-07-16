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
    // Respuestas directas de clientes al buzón ("RE: ...") → mensaje con aviso
    if (/^\s*(re|rv|fw|fwd)\s*:/i.test(raw.subject ?? "")) {
      await db
        .update(schema.rawEmails)
        .set({
          detectedSource: "unknown",
          detectedKind: "message",
          parseStatus: "ignored",
          parseError: null,
          processedAt: new Date(),
        })
        .where(eq(schema.rawEmails.id, raw.id));
      if (isRecent(raw.receivedAt)) {
        const sender = raw.fromAddress?.replace(/\s*<[^>]*>/, "").replace(/"/g, "") ?? "Cliente";
        await sendPushToOrg(raw.orgId, {
          title: `💬 Respuesta de cliente — ${sender}`,
          body: raw.subject ?? "Nuevo mensaje",
          url: "/emails",
          tag: `msg-${raw.id}`,
        });
      }
      return;
    }
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

  const kind = parser.classify(email);

  // Consultas/mensajes de clientes: no son reservas, pero avisan al equipo.
  if (kind === "message") {
    await db
      .update(schema.rawEmails)
      .set({
        detectedSource: parser.source,
        detectedKind: "message",
        parseStatus: "ignored",
        parseError: null,
        processedAt: new Date(),
      })
      .where(eq(schema.rawEmails.id, raw.id));
    if (isRecent(raw.receivedAt)) {
      const sender = raw.fromAddress?.replace(/\s*<[^>]*>/, "").replace(/"/g, "") ?? "Cliente";
      await sendPushToOrg(raw.orgId, {
        title: `💬 Consulta de cliente — ${sender}`,
        body: raw.subject ?? "Nuevo mensaje",
        url: "/emails",
        tag: `msg-${raw.id}`,
      });
    }
    return;
  }

  // Reseñas y demás correo de plataforma que no es una reserva
  if (kind === "other") {
    await db
      .update(schema.rawEmails)
      .set({
        detectedSource: parser.source,
        detectedKind: "other",
        parseStatus: "ignored",
        parseError: null,
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

  const result = await upsertParsedBooking(raw.orgId, parsed, raw.id, raw.subject);
  const bookingId = result.bookingId;

  if (isRecent(raw.receivedAt)) {
    await notifyBookingEvent(raw.orgId, parsed, bookingId);
    if (result.adHocCreated) {
      await sendPushToOrg(raw.orgId, {
        title: `📅 Salida extra creada — ${result.adHocCreated.time}`,
        body: `El ${result.adHocCreated.date} llegó una reserva fuera de la plantilla; se creó la salida automáticamente.`,
        url: `/cuadro/${result.adHocCreated.date}`,
        tag: `adhoc-${result.adHocCreated.date}-${result.adHocCreated.time}`,
      });
    }
    if (result.fallbackMapping) {
      await sendPushToOrg(raw.orgId, {
        title: "⚠ Producto sin regla de mapeo",
        body: `"${parsed.rawProductName}" se asignó a ${result.fallbackMapping}. Revísalo y crea la regla en Configuración.`,
        url: `/cuadro/${result.activityDate}`,
        tag: `fallback-${bookingId}`,
      });
    }
    if (result.unassigned) {
      await sendPushToOrg(raw.orgId, {
        title: "⚠ Reserva sin asignar",
        body: `${parsed.customerName ?? parsed.externalRef} · ${result.activityDate} — asígnala a una salida desde el cuadro.`,
        url: `/cuadro/${result.activityDate}`,
        tag: `unassigned-${bookingId}`,
      });
    }
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

export type UpsertResult = {
  bookingId: string;
  activityDate: string;
  /** Se creó una salida fuera de la plantilla */
  adHocCreated: { date: string; time: string } | null;
  /** Ninguna regla casó: descripción del destino elegido automáticamente */
  fallbackMapping: string | null;
  /** No se pudo asignar (varias playas y sin regla) */
  unassigned: boolean;
};

/** Upsert de la reserva parseada. */
export async function upsertParsedBooking(
  orgId: string,
  parsed: ParsedBooking,
  sourceEmailId: string | null,
  subject: string | null,
): Promise<UpsertResult> {
  const db = await getDb();

  // Cancelaciones/modificaciones pueden llegar sin fecha: se hereda de la
  // reserva existente (por referencia); si no existe, la fecha de recepción.
  const prior = await db
    .select()
    .from(schema.bookings)
    .where(
      and(
        eq(schema.bookings.orgId, orgId),
        eq(schema.bookings.source, parsed.source),
        eq(schema.bookings.externalRef, parsed.externalRef),
      ),
    );
  const activityDate =
    parsed.activityDate ??
    prior[0]?.activityDate ??
    new Date().toISOString().slice(0, 10);
  parsed = { ...parsed, activityDate };

  // Mapeo → producto/playa; franja por hora parseada (o forzada por la regla).
  const rules = await db
    .select()
    .from(schema.mappingRules)
    .where(eq(schema.mappingRules.orgId, orgId));
  const target = applyMappingRules(rules, parsed, subject);

  let departureId: string | null = null;
  let productId: string | null = null;
  let locationId: string | null = null;
  let adHocCreated: { date: string; time: string } | null = null;
  let fallbackMapping: string | null = null;

  // Sin regla que case: si la org tiene una sola playa, se asigna igualmente
  // (producto más parecido por nombre, o el primero), se aprende la regla y
  // se avisa. La reserva nunca se queda fuera del cuadro por falta de regla.
  let effectiveTarget = target;
  if (!effectiveTarget && parsed.kind === "new") {
    const [locations, products] = await Promise.all([
      db.select().from(schema.locations).where(eq(schema.locations.orgId, orgId)),
      db.select().from(schema.products).where(eq(schema.products.orgId, orgId)),
    ]);
    const activeLocations = locations.filter((l) => l.active);
    if (activeLocations.length === 1) {
      const loc = activeLocations[0];
      const candidates = products.filter((p) => p.active && p.locationId === loc.id);
      const byName =
        candidates.find((p) =>
          parsed.rawProductName.toLowerCase().includes(p.name.toLowerCase()),
        ) ?? candidates.find((p) => p.kind === "tour") ?? candidates[0];
      if (byName) {
        effectiveTarget = { productId: byName.id, locationId: loc.id };
        fallbackMapping = `${byName.name} · ${loc.name}`;
        // Regla aprendida (prioridad baja): el próximo email entra directo.
        const matchValue = (parsed.externalProductCode ?? parsed.rawProductName).slice(0, 120);
        const dup = rules.some(
          (r) => r.active && r.matchValue.toLowerCase() === matchValue.toLowerCase(),
        );
        if (!dup && matchValue.trim()) {
          await db.insert(schema.mappingRules).values({
            orgId,
            priority: 500,
            matchType: "contains",
            matchValue,
            targetProductId: byName.id,
            targetLocationId: loc.id,
          });
        }
      }
    }
  }

  if (effectiveTarget) {
    productId = effectiveTarget.productId;
    locationId = effectiveTarget.locationId;
    const slots = await db
      .select()
      .from(schema.timeSlots)
      .where(eq(schema.timeSlots.orgId, orgId));
    const slot = effectiveTarget.timeSlotId
      ? slots.find((s) => s.id === effectiveTarget!.timeSlotId) ?? null
      : resolveTimeSlot(slots, effectiveTarget.locationId, effectiveTarget.productId, parsed.activityTime);
    if (slot) {
      departureId = await ensureDeparture(orgId, slot.id, activityDate);
    } else if (parsed.activityTime) {
      // Hora fuera de la plantilla: se acepta igualmente creando una
      // salida "extra" para ese día a esa hora, con aviso.
      const adHoc = await ensureAdHocDeparture(
        orgId,
        activityDate,
        parsed.activityTime,
        effectiveTarget.productId,
        effectiveTarget.locationId,
        slots,
      );
      departureId = adHoc.id;
      if (adHoc.created) {
        adHocCreated = { date: activityDate, time: parsed.activityTime.slice(0, 5) };
      }
    }
  }

  const isCancellation = parsed.kind === "cancellation";
  const status = isCancellation
    ? ("cancelled" as const)
    : effectiveTarget && departureId
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
    activityDate,
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

  if (isCancellation && prior.length > 0) {
    // Una cancelación solo debe tocar el estado de la reserva existente.
    await db
      .update(schema.bookings)
      .set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.bookings.id, prior[0].id));
    return {
      bookingId: prior[0].id,
      activityDate,
      adHocCreated: null,
      fallbackMapping: null,
      unassigned: false,
    };
  }

  const inserted = await db
    .insert(schema.bookings)
    .values(values)
    .onConflictDoUpdate({
      target: [schema.bookings.orgId, schema.bookings.source, schema.bookings.externalRef],
      set: values,
    })
    .returning({ id: schema.bookings.id });
  return {
    bookingId: inserted[0].id,
    activityDate,
    adHocCreated,
    fallbackMapping,
    unassigned: status === "pending_review",
  };
}

/** Notifica alta/cancelación/modificación y, si procede, la sobre-reserva. */
async function notifyBookingEvent(
  orgId: string,
  parsed: ParsedBooking,
  bookingId: string,
): Promise<void> {
  const db = await getDb();
  const [booking] = await db
    .select()
    .from(schema.bookings)
    .where(eq(schema.bookings.id, bookingId));
  if (!booking) return;

  const pax = booking.paxAdults + booking.paxChildren;
  const when = `${booking.activityDate}${booking.activityTime ? ` · ${booking.activityTime.slice(0, 5)}` : ""}`;
  const who = booking.customerName ?? booking.externalRef;
  const url = `/cuadro/${booking.activityDate}`;

  const titles = {
    new: `🛶 Nueva reserva — ${parsed.channel}`,
    cancellation: `✕ Reserva cancelada — ${parsed.channel}`,
    amendment: `✎ Reserva modificada — ${parsed.channel}`,
    message: null,
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
  if (!booking.departureId) return;
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
): Promise<{ id: string; created: boolean }> {
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
  if (existing.length > 0) return { id: existing[0].id, created: false };

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
  return { id: row.id, created: true };
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
