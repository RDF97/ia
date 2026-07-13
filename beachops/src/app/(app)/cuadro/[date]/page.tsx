import Link from "next/link";
import { notFound } from "next/navigation";
import {
  assignBooking,
  cancelBooking,
  confirmCashEntry,
  toggleDoubleDeparture,
} from "@/server/actions";
import { requireSession } from "@/server/auth";
import { getBoard } from "@/server/board/query";
import { getDb, schema } from "@/server/db";
import { Booking } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { flagEmoji, formatDateEs, formatEuro, shiftDate } from "@/lib/format";
import { AutoRefresh } from "./auto-refresh";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

export default async function CuadroPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();
  const session = await requireSession();
  const board = await getBoard(session.orgId, date);
  const db = await getDb();
  const slots = await db
    .select()
    .from(schema.timeSlots)
    .where(eq(schema.timeSlots.orgId, session.orgId));
  const products = await db
    .select()
    .from(schema.products)
    .where(eq(schema.products.orgId, session.orgId));
  const productName = (id: string | null) =>
    products.find((p) => p.id === id)?.name ?? "—";

  return (
    <div className="space-y-4">
      <AutoRefresh seconds={30} />

      {/* Cabecera */}
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold capitalize">{formatDateEs(date)}</h1>
        <div className="no-print flex items-center gap-1 text-sm">
          <Link href={`/cuadro/${shiftDate(date, -1)}`} className="px-2 py-1 rounded bg-white border border-slate-300 hover:bg-slate-100">←</Link>
          <Link href="/" className="px-2 py-1 rounded bg-white border border-slate-300 hover:bg-slate-100">hoy</Link>
          <Link href={`/cuadro/${shiftDate(date, 1)}`} className="px-2 py-1 rounded bg-white border border-slate-300 hover:bg-slate-100">→</Link>
        </div>
        <div className="ml-auto no-print flex gap-2">
          <Link
            href={`/reservas/nueva?date=${date}`}
            className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
          >
            + Reserva
          </Link>
          <PrintButton />
        </div>
      </header>

      {/* Stats */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Total pax" value={String(board.stats.paxTotal)} sub={`${board.stats.paxAdults} adultos + ${board.stats.paxChildren} niños`} />
        <Stat label="Caja efectivo" value={board.cashPending > 0 ? `${formatEuro(board.cashTotal)}+` : formatEuro(board.cashTotal)} sub={board.cashPending > 0 ? `${board.cashPending} pdte. confirmar` : "confirmada"} accent={board.cashPending > 0 ? "amber" : undefined} />
        <Stat label="Excursiones" value={String(board.stats.excursions)} sub={board.stats.channels.join(" · ") || "—"} />
        <Stat
          label="Alertas"
          value={String(board.stats.overbookedSlots + board.stats.pendingReview + board.stats.failedEmails)}
          sub={[
            board.stats.overbookedSlots > 0 ? `${board.stats.overbookedSlots} sobre-reserva` : null,
            board.stats.pendingReview > 0 ? `${board.stats.pendingReview} sin asignar` : null,
            board.stats.failedEmails > 0 ? `${board.stats.failedEmails} emails fallidos` : null,
          ].filter(Boolean).join(" · ") || "sin alertas"}
          accent={board.stats.overbookedSlots + board.stats.pendingReview + board.stats.failedEmails > 0 ? "red" : undefined}
        />
      </section>

      {/* Sin asignar */}
      {board.unassigned.length > 0 && (
        <section className="print-block bg-amber-50 border border-amber-300 rounded-xl p-3 space-y-2">
          <h2 className="font-semibold text-amber-800 text-sm">
            ⚠ Reservas sin asignar a franja — elige salida
          </h2>
          {board.unassigned.map((b) => (
            <div key={b.id} className="flex flex-wrap items-center gap-2 text-sm bg-white rounded-lg p-2">
              <BookingCells b={b} date={date} />
              <form action={assignBooking.bind(null, b.id)} className="no-print flex items-center gap-1 ml-auto">
                <SlotSelect
                  slots={slots.map((s) => ({ id: s.id, label: `${s.startTime.slice(0, 5)} ${productName(s.productId)}` }))}
                  date={date}
                />
              </form>
            </div>
          ))}
        </section>
      )}

      {/* Cuadro por playa */}
      {board.locations.map((loc) => (
        <section key={loc.locationId} className="space-y-3">
          <h2 className="text-xs font-bold tracking-widest text-slate-400 uppercase">
            📍 {loc.name} · {loc.paxTotal} pax
          </h2>
          {loc.groups.map((g) => (
            <div key={g.timeSlotId} className="slot-card bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="flex items-center gap-3 px-3 py-2 border-b border-slate-100">
                <span className="font-bold text-lg">{g.startTime}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${g.productKind === "private" ? "bg-purple-100 text-purple-700" : g.productName === "Paddle Surf" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}>
                  {g.productName}
                </span>
                {g.isDouble && (
                  <span className="text-xs font-bold text-red-600">DOBLE SALIDA</span>
                )}
                <span className={`ml-auto font-bold ${g.overbookedBy > 0 ? "text-red-600" : "text-slate-700"}`}>
                  {g.paxTotal}/{g.capacity}
                  {g.overbookedBy > 0 && ` · +${g.overbookedBy}`}
                </span>
                <form action={toggleDoubleDeparture.bind(null, g.timeSlotId, date)} className="no-print">
                  <button
                    className="text-xs px-2 py-1 rounded border border-slate-300 text-slate-500 hover:bg-slate-100"
                    title="Duplicar cupo (doble salida)"
                  >
                    {g.isDouble ? "quitar doble" : "doble salida"}
                  </button>
                </form>
              </div>
              {g.bookings.length === 0 ? (
                <p className="px-3 py-2 text-sm text-slate-400">Sin reservas</p>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {g.bookings.map((b) => (
                      <tr key={b.id} className="border-b border-slate-50 last:border-0">
                        <td className="px-3 py-1.5 font-bold w-10">{b.paxAdults + b.paxChildren}</td>
                        <td className="px-2 py-1.5">
                          {b.customerName ?? "—"}
                          {b.paxChildren > 0 && (
                            <span className="text-xs text-purple-600"> · {b.paxChildren} niño{b.paxChildren > 1 ? "s" : ""}</span>
                          )}
                          {b.pickupHotel && <span className="text-xs text-slate-500"> · Hotel {b.pickupHotel}</span>}
                        </td>
                        <td className="px-2 py-1.5">{flagEmoji(b.customerCountry)}</td>
                        <td className="px-2 py-1.5 whitespace-nowrap">
                          {b.customerPhone && (
                            <a href={`tel:${b.customerPhone}`} className="text-blue-600">{b.customerPhone}</a>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-xs text-slate-400 font-mono">{b.externalRef ?? b.channel}</td>
                        <td className="px-2 py-1.5 text-right whitespace-nowrap">
                          <PaymentBadge b={b} />
                        </td>
                        <td className="px-2 py-1.5 no-print w-8 text-right">
                          <form action={cancelBooking.bind(null, b.id, date)}>
                            <button className="text-slate-300 hover:text-red-600" title="Cancelar reserva">✕</button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {g.bookings.length > 0 && (
                <div className="px-3 py-1.5 text-xs text-slate-500 bg-slate-50 flex justify-between">
                  <span>
                    Total: {g.paxAdults} adultos{g.paxChildren > 0 ? ` + ${g.paxChildren} niños` : ""}
                    {g.overbookedBy > 0 && (
                      <strong className="text-red-600"> · cupo +{g.overbookedBy} · dividir o mover</strong>
                    )}
                  </span>
                  <span className={g.overbookedBy > 0 ? "text-red-600 font-bold" : "text-emerald-600 font-semibold"}>
                    {g.overbookedBy > 0 ? `Exceso: +${g.overbookedBy}` : `Libre: ${g.free}`}
                  </span>
                </div>
              )}
            </div>
          ))}
        </section>
      ))}

      {/* Caja del día */}
      <section className="print-block bg-white rounded-xl shadow-sm border border-slate-200 p-3 space-y-2">
        <h2 className="font-bold">💶 Caja del día — Efectivo</h2>
        {board.cashEntries.length === 0 ? (
          <p className="text-sm text-slate-400">Sin movimientos de efectivo</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {board.cashEntries.map((c) => (
                <tr key={c.id} className="border-b border-dashed border-slate-200 last:border-0">
                  <td className="py-1.5">{c.concept}</td>
                  <td className="py-1.5 text-right font-semibold">
                    {c.amount == null ? (
                      <span className="text-amber-600">por confirmar</span>
                    ) : (
                      formatEuro(c.amount)
                    )}
                    {c.amount != null && !c.confirmed && (
                      <span className="text-amber-600 text-xs"> · sin confirmar</span>
                    )}
                  </td>
                  <td className="py-1.5 pl-2 w-40 text-right no-print">
                    {!c.confirmed && (
                      <form action={confirmCashEntry.bind(null, c.id, date)} className="flex gap-1 justify-end">
                        {c.amount == null && (
                          <input
                            name="amount"
                            placeholder="€"
                            className="w-16 rounded border border-slate-300 px-1 py-0.5 text-xs"
                          />
                        )}
                        <button className="text-xs px-2 py-0.5 rounded bg-emerald-600 text-white">confirmar</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
              <tr className="font-bold">
                <td className="py-1.5">TOTAL EFECTIVO {board.cashPending > 0 ? "(parcial)" : ""}</td>
                <td className="py-1.5 text-right">
                  {formatEuro(board.cashTotal)}
                  {board.cashPending > 0 && " + pdte."}
                </td>
                <td className="no-print" />
              </tr>
            </tbody>
          </table>
        )}
      </section>

      {/* Resumen del día */}
      <section className="print-block bg-white rounded-xl shadow-sm border border-slate-200 p-3">
        <h2 className="font-bold mb-2">Resumen día {date.slice(8, 10)}-{date.slice(5, 7)}</h2>
        <table className="w-full text-sm">
          <tbody>
            {board.locations.flatMap((l) =>
              l.groups
                .filter((g) => g.paxTotal > 0)
                .map((g) => (
                  <tr key={g.timeSlotId} className="border-b border-dashed border-slate-200">
                    <td className="py-1 font-mono">{g.startTime}</td>
                    <td className="py-1">
                      {l.name} · {g.productName}
                      {g.isDouble ? " (doble salida)" : ""}
                    </td>
                    <td className="py-1 text-right">
                      {g.paxTotal} pax
                      {g.paxChildren > 0 && ` (${g.paxAdults} ad. + ${g.paxChildren} niños)`}
                    </td>
                  </tr>
                )),
            )}
            <tr className="font-bold">
              <td className="py-1.5" colSpan={2}>TOTAL DEL DÍA</td>
              <td className="py-1.5 text-right">
                {board.stats.paxTotal} pax ({board.stats.paxAdults} ad. + {board.stats.paxChildren} niños)
              </td>
            </tr>
          </tbody>
        </table>
        <p className="text-xs text-slate-400 mt-1">
          Canales: {board.stats.channels.join(" · ") || "—"} · Países: {board.stats.countries.length}
        </p>
      </section>

      {/* Canceladas */}
      {board.cancelled.length > 0 && (
        <section className="no-print text-xs text-slate-400">
          <h3 className="font-semibold mb-1">Canceladas hoy</h3>
          {board.cancelled.map((b) => (
            <p key={b.id} className="line-through">
              {b.activityTime?.slice(0, 5)} · {b.customerName} · {b.paxAdults + b.paxChildren} pax · {b.externalRef}
            </p>
          ))}
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: "red" | "amber" }) {
  const color = accent === "red" ? "text-red-600" : accent === "amber" ? "text-amber-600" : "text-slate-900";
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

function PaymentBadge({ b }: { b: Booking }) {
  if (b.paymentKind === "platform") return <span className="text-emerald-600" title="Cobrado por plataforma">✓</span>;
  if (b.paymentKind === "cash" && b.cashAmount != null)
    return <span className="text-slate-700 font-semibold">{formatEuro(b.cashAmount)}</span>;
  return <span className="text-amber-600 text-xs font-semibold">por confirmar</span>;
}

function BookingCells({ b, date }: { b: Booking; date: string }) {
  return (
    <>
      <span className="font-bold">{b.paxAdults + b.paxChildren}</span>
      <span>{b.customerName ?? "—"}</span>
      <span className="text-slate-400">{b.activityTime?.slice(0, 5) ?? date}</span>
      <span className="text-xs text-slate-400 font-mono">{b.externalRef}</span>
      <span className="text-xs text-slate-500 max-w-60 truncate">{b.rawProductName}</span>
    </>
  );
}

function SlotSelect({ slots, date }: { slots: { id: string; label: string }[]; date: string }) {
  return (
    <>
      <input type="hidden" name="date" value={date} />
      <select name="timeSlotId" className="rounded border border-slate-300 px-1 py-0.5 text-xs" required>
        <option value="">franja…</option>
        {slots.map((s) => (
          <option key={s.id} value={s.id}>{s.label}</option>
        ))}
      </select>
      <button className="text-xs px-2 py-0.5 rounded bg-blue-600 text-white">asignar</button>
    </>
  );
}
