import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { requireSession } from "@/server/auth";
import { getDb, schema } from "@/server/db";
import { flagEmoji, formatEuro } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  confirmed: { text: "confirmada", cls: "bg-emerald-100 text-emerald-700" },
  cancelled: { text: "cancelada", cls: "bg-red-100 text-red-600" },
  amended: { text: "modificada", cls: "bg-blue-100 text-blue-700" },
  pending_review: { text: "sin asignar", cls: "bg-amber-100 text-amber-700" },
};

export default async function ReservasPage() {
  const session = await requireSession();
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.bookings)
    .where(eq(schema.bookings.orgId, session.orgId))
    .orderBy(desc(schema.bookings.activityDate), desc(schema.bookings.createdAt))
    .limit(200);

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <h1 className="text-xl font-bold">Reservas</h1>
        <Link
          href="/reservas/nueva"
          className="ml-auto px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
        >
          + Reserva manual
        </Link>
      </header>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-slate-400 text-left">
            <tr>
              <th className="px-3 py-2">Fecha</th>
              <th className="px-2 py-2">Hora</th>
              <th className="px-2 py-2">Pax</th>
              <th className="px-2 py-2">Cliente</th>
              <th className="px-2 py-2">Canal</th>
              <th className="px-2 py-2">Referencia</th>
              <th className="px-2 py-2">Importe</th>
              <th className="px-2 py-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => {
              const s = STATUS_LABEL[b.status];
              return (
                <tr key={b.id} className="border-t border-slate-100">
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    <Link href={`/cuadro/${b.activityDate}`} className="text-blue-600">
                      {b.activityDate}
                    </Link>
                  </td>
                  <td className="px-2 py-1.5">{b.activityTime?.slice(0, 5) ?? "—"}</td>
                  <td className="px-2 py-1.5 font-semibold">{b.paxAdults + b.paxChildren}</td>
                  <td className="px-2 py-1.5">
                    {flagEmoji(b.customerCountry)} {b.customerName ?? "—"}
                  </td>
                  <td className="px-2 py-1.5">{b.channel}</td>
                  <td className="px-2 py-1.5 text-xs font-mono text-slate-400">{b.externalRef ?? "manual"}</td>
                  <td className="px-2 py-1.5">
                    {b.paymentKind === "platform" ? formatEuro(b.priceAmount) : formatEuro(b.cashAmount)}
                  </td>
                  <td className="px-2 py-1.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${s.cls}`}>{s.text}</span>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-400">Todavía no hay reservas. Conecta tu Gmail en Configuración.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
