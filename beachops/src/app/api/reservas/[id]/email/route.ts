import { and, eq } from "drizzle-orm";
import { getSession } from "@/server/auth";
import { getDb, schema } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * El email original de una reserva, para verlo desde el cuadro sin salir de él.
 * Devuelve el HTML crudo tal cual llegó (se pinta aislado en un iframe) más los
 * datos de cabecera.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return Response.json({ error: "No autenticado" }, { status: 401 });

  const { id } = await params;
  const db = await getDb();
  const [booking] = await db
    .select()
    .from(schema.bookings)
    .where(and(eq(schema.bookings.id, id), eq(schema.bookings.orgId, session.orgId)));
  if (!booking) return Response.json({ error: "Reserva no encontrada" }, { status: 404 });

  if (!booking.sourceEmailId) {
    return Response.json({
      booking: summary(booking),
      email: null,
      reason:
        booking.source === "manual"
          ? "Es una reserva manual: no tiene email de origen."
          : "Esta reserva no tiene guardado el email de origen.",
    });
  }

  const [raw] = await db
    .select()
    .from(schema.rawEmails)
    .where(
      and(eq(schema.rawEmails.id, booking.sourceEmailId), eq(schema.rawEmails.orgId, session.orgId)),
    );
  if (!raw) {
    return Response.json({
      booking: summary(booking),
      email: null,
      reason: "El email de origen ya no está guardado.",
    });
  }

  return Response.json({
    booking: summary(booking),
    email: {
      id: raw.id,
      subject: raw.subject,
      fromAddress: raw.fromAddress,
      receivedAt: raw.receivedAt,
      parseStatus: raw.parseStatus,
      html: raw.bodyHtml ?? null,
      text: raw.bodyText ?? null,
    },
  });
}

function summary(booking: typeof schema.bookings.$inferSelect) {
  return {
    id: booking.id,
    customerName: booking.customerName,
    externalRef: booking.externalRef,
    channel: booking.channel,
    source: booking.source,
    activityDate: booking.activityDate,
    activityTime: booking.activityTime,
    pax: booking.paxAdults + booking.paxChildren,
  };
}
