import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { getSession } from "@/server/auth";
import { getDb, schema } from "@/server/db";

export const dynamic = "force-dynamic";

function csvField(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Exporta las reservas a CSV (compatible Excel): /api/reservas.csv?from=&to= */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return new NextResponse("No autorizado", { status: 401 });

  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  const db = await getDb();
  const conditions = [eq(schema.bookings.orgId, session.orgId)];
  if (from) conditions.push(gte(schema.bookings.activityDate, from));
  if (to) conditions.push(lte(schema.bookings.activityDate, to));

  const rows = await db
    .select()
    .from(schema.bookings)
    .where(and(...conditions))
    .orderBy(asc(schema.bookings.activityDate), asc(schema.bookings.activityTime));

  const header = [
    "fecha", "hora", "estado", "canal", "referencia", "producto",
    "adultos", "niños", "cliente", "pais", "telefono", "idioma",
    "importe", "moneda", "pago", "efectivo", "hotel", "notas",
  ];
  const lines = rows.map((b) =>
    [
      b.activityDate, b.activityTime?.slice(0, 5), b.status, b.channel, b.externalRef,
      b.rawProductName, b.paxAdults, b.paxChildren, b.customerName, b.customerCountry,
      b.customerPhone, b.customerLanguage, b.priceAmount, b.priceCurrency,
      b.paymentKind, b.cashAmount, b.pickupHotel, b.notes,
    ]
      .map(csvField)
      .join(";"),
  );
  // BOM para que Excel abra el UTF-8 con acentos bien
  const csv = "﻿" + [header.join(";"), ...lines].join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="reservas${from ? `-${from}` : ""}${to ? `-${to}` : ""}.csv"`,
    },
  });
}
