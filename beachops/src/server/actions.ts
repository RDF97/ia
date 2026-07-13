"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSessionCookie, destroySession, requireSession } from "./auth";
import { verifyPassword } from "./crypto";
import { getDb, schema } from "./db";
import { syncAllAccounts } from "./gmail/sync";
import { ensureDeparture, processRawEmail } from "./ingest/process";
import { parsePhone } from "./parsers/phone";

// ── Sesión ─────────────────────────────────────────────────────────────

export async function login(_prev: { error?: string }, formData: FormData) {
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const password = String(formData.get("password") ?? "");
  const db = await getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email));
  if (!user?.passwordHash || !verifyPassword(password, user.passwordHash)) {
    return { error: "Email o contraseña incorrectos" };
  }
  const [membership] = await db
    .select()
    .from(schema.memberships)
    .where(eq(schema.memberships.userId, user.id));
  if (!membership) return { error: "El usuario no pertenece a ninguna empresa" };
  await createSessionCookie({
    userId: user.id,
    orgId: membership.orgId,
    email: user.email,
    name: user.name,
    role: membership.role,
  });
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

// ── Cuadro ─────────────────────────────────────────────────────────────

export async function toggleDoubleDeparture(timeSlotId: string, date: string) {
  const session = await requireSession();
  const db = await getDb();
  const departureId = await ensureDeparture(session.orgId, timeSlotId, date);
  const [dep] = await db
    .select()
    .from(schema.departures)
    .where(eq(schema.departures.id, departureId));
  const [slot] = await db
    .select()
    .from(schema.timeSlots)
    .where(eq(schema.timeSlots.id, timeSlotId));
  const enable = !dep.isDouble;
  await db
    .update(schema.departures)
    .set({
      isDouble: enable,
      capacityOverride: enable ? slot.defaultCapacity * 2 : null,
    })
    .where(eq(schema.departures.id, departureId));
  revalidatePath(`/cuadro/${date}`);
}

export async function cancelBooking(bookingId: string, date: string) {
  const session = await requireSession();
  const db = await getDb();
  await db
    .update(schema.bookings)
    .set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() })
    .where(
      and(eq(schema.bookings.id, bookingId), eq(schema.bookings.orgId, session.orgId)),
    );
  revalidatePath(`/cuadro/${date}`);
}

/** Asigna manualmente una reserva sin franja (pending_review) a una salida. */
export async function assignBooking(bookingId: string, formData: FormData) {
  const session = await requireSession();
  const db = await getDb();
  const timeSlotId = String(formData.get("timeSlotId"));
  const date = String(formData.get("date"));
  const departureId = await ensureDeparture(session.orgId, timeSlotId, date);
  const [slot] = await db
    .select()
    .from(schema.timeSlots)
    .where(eq(schema.timeSlots.id, timeSlotId));
  await db
    .update(schema.bookings)
    .set({
      departureId,
      status: "confirmed",
      productId: slot.productId,
      locationId: slot.locationId,
      updatedAt: new Date(),
    })
    .where(
      and(eq(schema.bookings.id, bookingId), eq(schema.bookings.orgId, session.orgId)),
    );
  revalidatePath(`/cuadro/${date}`);
}

// ── Reserva manual ─────────────────────────────────────────────────────

export async function createManualBooking(formData: FormData) {
  const session = await requireSession();
  const db = await getDb();

  const date = String(formData.get("date"));
  const timeSlotId = String(formData.get("timeSlotId"));
  const paymentKind = String(formData.get("paymentKind")) as "cash" | "pending" | "platform";
  const cashAmountRaw = String(formData.get("cashAmount") ?? "").replace(",", ".").trim();
  const cashAmount = cashAmountRaw ? cashAmountRaw : null;
  const { phone, country } = parsePhone(String(formData.get("customerPhone") ?? ""));

  const [slot] = await db
    .select()
    .from(schema.timeSlots)
    .where(
      and(eq(schema.timeSlots.id, timeSlotId), eq(schema.timeSlots.orgId, session.orgId)),
    );
  if (!slot) throw new Error("Franja no válida");
  const departureId = await ensureDeparture(session.orgId, timeSlotId, date);

  const [booking] = await db
    .insert(schema.bookings)
    .values({
      orgId: session.orgId,
      departureId,
      source: "manual",
      channel: String(formData.get("channel") ?? "Directa"),
      status: "confirmed",
      activityDate: date,
      activityTime: slot.startTime,
      productId: slot.productId,
      locationId: slot.locationId,
      paxAdults: Number(formData.get("paxAdults") ?? 0),
      paxChildren: Number(formData.get("paxChildren") ?? 0),
      customerName: String(formData.get("customerName") ?? "") || null,
      customerPhone: phone ?? null,
      customerCountry: country ?? null,
      paymentKind,
      cashAmount: paymentKind === "cash" ? cashAmount : null,
      cashConfirmed: paymentKind === "cash" && cashAmount != null,
      pickupHotel: String(formData.get("pickupHotel") ?? "") || null,
      notes: String(formData.get("notes") ?? "") || null,
    })
    .returning();

  if (paymentKind === "cash" || paymentKind === "pending") {
    await db.insert(schema.cashEntries).values({
      orgId: session.orgId,
      date,
      bookingId: booking.id,
      concept: `${booking.channel} ${slot.startTime.slice(0, 5)} — ${booking.customerName ?? "sin nombre"}`,
      amount: paymentKind === "cash" ? cashAmount : null,
      confirmed: paymentKind === "cash" && cashAmount != null,
    });
  }

  revalidatePath(`/cuadro/${date}`);
  redirect(`/cuadro/${date}`);
}

export async function confirmCashEntry(entryId: string, date: string, formData: FormData) {
  const session = await requireSession();
  const db = await getDb();
  const amountRaw = String(formData.get("amount") ?? "").replace(",", ".").trim();
  await db
    .update(schema.cashEntries)
    .set({ confirmed: true, ...(amountRaw ? { amount: amountRaw } : {}) })
    .where(
      and(eq(schema.cashEntries.id, entryId), eq(schema.cashEntries.orgId, session.orgId)),
    );
  revalidatePath(`/cuadro/${date}`);
}

// ── Emails ─────────────────────────────────────────────────────────────

export async function reprocessEmail(rawEmailId: string) {
  const session = await requireSession();
  const db = await getDb();
  const [raw] = await db
    .select()
    .from(schema.rawEmails)
    .where(
      and(eq(schema.rawEmails.id, rawEmailId), eq(schema.rawEmails.orgId, session.orgId)),
    );
  if (raw) await processRawEmail(raw);
  revalidatePath("/emails");
}

export async function ignoreEmail(rawEmailId: string) {
  const session = await requireSession();
  const db = await getDb();
  await db
    .update(schema.rawEmails)
    .set({ parseStatus: "ignored" })
    .where(
      and(eq(schema.rawEmails.id, rawEmailId), eq(schema.rawEmails.orgId, session.orgId)),
    );
  revalidatePath("/emails");
}

export async function syncNow() {
  await requireSession();
  await syncAllAccounts();
  revalidatePath("/");
}

// ── Coordenadas de la org (para la meteo del cuadro) ───────────────────

export async function updateOrgCoords(formData: FormData) {
  const session = await requireSession();
  const db = await getDb();
  const lat = Number(String(formData.get("lat")).replace(",", "."));
  const lng = Number(String(formData.get("lng")).replace(",", "."));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error("Coordenadas no válidas");
  const [org] = await db
    .select()
    .from(schema.orgs)
    .where(eq(schema.orgs.id, session.orgId));
  const settings = { ...(org.settings as object), lat, lng };
  await db.update(schema.orgs).set({ settings }).where(eq(schema.orgs.id, session.orgId));
  revalidatePath("/config");
  revalidatePath("/");
}

// ── Notificaciones push ────────────────────────────────────────────────

export async function savePushSubscription(sub: {
  endpoint: string;
  p256dh?: string;
  auth?: string;
  userAgent?: string;
}) {
  const session = await requireSession();
  if (!sub.endpoint || !sub.p256dh || !sub.auth) throw new Error("Suscripción incompleta");
  const db = await getDb();
  await db
    .insert(schema.pushSubscriptions)
    .values({
      orgId: session.orgId,
      userId: session.userId,
      endpoint: sub.endpoint,
      p256dh: sub.p256dh,
      auth: sub.auth,
      userAgent: sub.userAgent,
    })
    .onConflictDoNothing();
}

export async function deletePushSubscription(endpoint: string) {
  const session = await requireSession();
  const db = await getDb();
  await db
    .delete(schema.pushSubscriptions)
    .where(
      and(
        eq(schema.pushSubscriptions.orgId, session.orgId),
        eq(schema.pushSubscriptions.endpoint, endpoint),
      ),
    );
}

export async function sendTestPush() {
  const session = await requireSession();
  const { sendPushToOrg } = await import("./push");
  await sendPushToOrg(session.orgId, {
    title: "BeachOps",
    body: "Notificación de prueba: todo funciona 🎉",
    url: "/",
    tag: "test",
  });
}

// ── Config: reglas de mapeo ────────────────────────────────────────────

export async function createMappingRule(formData: FormData) {
  const session = await requireSession();
  const db = await getDb();
  await db.insert(schema.mappingRules).values({
    orgId: session.orgId,
    priority: Number(formData.get("priority") ?? 100),
    matchType: String(formData.get("matchType") ?? "contains") as "contains" | "regex" | "equals",
    matchValue: String(formData.get("matchValue")),
    targetProductId: String(formData.get("targetProductId")),
    targetLocationId: String(formData.get("targetLocationId")),
  });
  revalidatePath("/config");
}

export async function deleteMappingRule(ruleId: string) {
  const session = await requireSession();
  const db = await getDb();
  await db
    .update(schema.mappingRules)
    .set({ active: false })
    .where(
      and(eq(schema.mappingRules.id, ruleId), eq(schema.mappingRules.orgId, session.orgId)),
    );
  revalidatePath("/config");
}
