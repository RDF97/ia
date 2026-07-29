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
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold md:text-xl">Reservas</h1>
        <a
          href="/api/reservas.csv"
          className="tap ml-auto inline-flex items-center rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm active:bg-slate-100"
        >
          ⬇ CSV
        </a>
        <Link
          href="/reservas/nueva"
          className="tap inline-flex items-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white active:bg-blue-700"
        >
          + Reserva
        </Link>
      </header>

      {/* Móvil: cada reserva en su tarjeta, legible y tocable */}
      <ul className="space-y-2 md:hidden">
        {rows.map((b) => {
          const s = STATUS_LABEL[b.status];
          return (
            <li key={b.id} className="rounded-xl border border-slate-200 bg-white p-3">
              <Link href={`/cuadro/${b.activityDate}`} className="tap flex items-start gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 font-bold tabular-nums">
                  {b.paxAdults + b.paxChildren}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">
                    {flagEmoji(b.customerCountry)} {b.customerName ?? "—"}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {b.activityDate}
                    {b.activityTime && ` · ${b.activityTime.slice(0, 5)}`} · {b.channel ?? "—"}
                  </span>
                  <span className="mt-0.5 block font-mono text-[11px] text-slate-400">
                    {b.externalRef ?? "manual"}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-sm font-semibold">
                    {b.paymentKind === "platform" ? formatEuro(b.priceAmount) : formatEuro(b.cashAmount)}
                  </span>
                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.cls}`}>
                    {s.text}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
        {rows.length === 0 && (
          <li className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-400">
            Todavía no hay reservas. Conecta tu Gmail en Configuración.
          </li>
        )}
      </ul>

      {/* Escritorio: tabla completa */}
      <div className="momentum hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm md:block">
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
