import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/server/auth";
import { getWeek, mondayOf } from "@/server/board/week";
import { shiftDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const DAY_NAMES = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

export default async function SemanaPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();
  const session = await requireSession();
  const monday = mondayOf(date);
  const week = await getWeek(session.orgId, monday);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">
          Semana del {monday.slice(8, 10)}/{monday.slice(5, 7)} al {week.days[6].slice(8, 10)}/{week.days[6].slice(5, 7)}
        </h1>
        <div className="no-print flex items-center gap-1 text-sm">
          <Link href={`/semana/${shiftDate(monday, -7)}`} className="px-2 py-1 rounded bg-white border border-slate-300 hover:bg-slate-100">← anterior</Link>
          <Link href={`/semana/${today}`} className="px-2 py-1 rounded bg-white border border-slate-300 hover:bg-slate-100">esta semana</Link>
          <Link href={`/semana/${shiftDate(monday, 7)}`} className="px-2 py-1 rounded bg-white border border-slate-300 hover:bg-slate-100">siguiente →</Link>
        </div>
      </header>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto print-block">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-400">
              <th className="px-3 py-2 text-left">Salida</th>
              {week.days.map((day, i) => (
                <th key={day} className={`px-2 py-2 text-center ${day === today ? "text-blue-700" : ""}`}>
                  <Link href={`/cuadro/${day}`} className="hover:underline">
                    <span className="block font-semibold">{DAY_NAMES[i]}</span>
                    <span>{day.slice(8, 10)}/{day.slice(5, 7)}</span>
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {week.rows.map((row) => (
              <tr key={row.timeSlotId} className="border-t border-slate-100">
                <td className="px-3 py-1.5 whitespace-nowrap">
                  <span className="font-bold">{row.startTime}</span>{" "}
                  <span className="text-slate-500">{row.productName}</span>
                </td>
                {row.cells.map((cell, i) => {
                  const day = week.days[i];
                  if (!cell) return <td key={day} />;
                  const cls = cell.overbooked
                    ? "bg-red-100 text-red-700 font-bold"
                    : cell.paxTotal >= cell.capacity
                      ? "bg-amber-100 text-amber-700 font-semibold"
                      : cell.paxTotal > 0
                        ? "bg-emerald-50 text-emerald-800"
                        : "text-slate-300";
                  return (
                    <td key={day} className="px-1 py-1 text-center">
                      <Link
                        href={`/cuadro/${day}`}
                        className={`block rounded-lg px-1 py-1.5 hover:ring-2 hover:ring-blue-300 ${cls}`}
                        title={`${row.startTime} ${row.productName} · ${cell.paxTotal}/${cell.capacity}${cell.isDouble ? " · doble salida" : ""}`}
                      >
                        {cell.paxTotal}/{cell.capacity}
                        {cell.isDouble && <span className="block text-[10px] leading-none">2×</span>}
                      </Link>
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="border-t-2 border-slate-200 font-bold">
              <td className="px-3 py-2">Total pax</td>
              {week.dayTotals.map((t, i) => (
                <td key={week.days[i]} className="px-2 py-2 text-center">
                  {t.paxTotal > 0 ? (
                    <span title={`${t.paxAdults} adultos + ${t.paxChildren} niños`}>{t.paxTotal}</span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">
        Verde: con reservas · Ámbar: completo · Rojo: sobre-reservado · 2×: doble salida. Toca
        cualquier celda para abrir el cuadro de ese día.
      </p>
    </div>
  );
}
