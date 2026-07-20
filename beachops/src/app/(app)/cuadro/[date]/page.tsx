import Link from "next/link";
import { notFound } from "next/navigation";
import {
  assignBooking,
  cancelBooking,
  confirmCashEntry,
  toggleDoubleAdHoc,
  toggleDoubleDeparture,
} from "@/server/actions";
import { requireSession } from "@/server/auth";
import { getBoard, BoardSlotGroup } from "@/server/board/query";
import { Badge, BOARD_BG, CHILD_COLOR, MONITOR_BADGE } from "@/server/board/rules";
import { getDb, schema } from "@/server/db";
import { Booking } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { flagEmoji, formatDateEs, formatEuro, shiftDate } from "@/lib/format";
import { getDayWeather, orgCoords, HourWeather } from "@/server/weather";
import { AutoRefresh } from "./auto-refresh";
import { PrintButton } from "./print-button";
import { BoardChart } from "./chart";

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

  // Meteo en las horas de salida (solo si la org tiene coordenadas configuradas)
  const [org] = await db
    .select()
    .from(schema.orgs)
    .where(eq(schema.orgs.id, session.orgId));
  const coords = orgCoords(org?.settings);
  const slotHours = [...new Set(slots.filter((s) => s.active).map((s) => s.startTime.slice(0, 5)))]
    .sort()
    .map((h) => `${h.slice(0, 2)}:00`);
  const weather = coords
    ? await getDayWeather(coords.lat, coords.lng, date, [...new Set(slotHours)], org.timezone)
    : null;

  // Avisos operativos (instructivo §4)
  const santanyiSlots = board.locations
    .filter((l) => l.isSantanyi)
    .flatMap((l) => l.groups.filter((g) => g.paxTotal > 0));
  const splitGroups = board.locations.flatMap((l) =>
    l.groups.filter((g) => g.needsSplit).map((g) => `${g.startTime} ${g.productName}`),
  );
  const soldOutGroups = board.locations.flatMap((l) =>
    l.groups.filter((g) => g.paxTotal > 0 && g.free === 0 && !g.needsSplit).map((g) => g.startTime),
  );
  const avisos: string[] = [];
  if (splitGroups.length)
    avisos.push(`Dividir en varias salidas (≥16): ${splitGroups.join(" · ")}`);
  if (soldOutGroups.length)
    avisos.push(`Franjas al completo: ${[...new Set(soldOutGroups)].join(" · ")}`);
  if (santanyiSlots.length)
    avisos.push(
      `Salida${santanyiSlots.length > 1 ? "s" : ""} de Cala Santanyí (monitor aparte): ${santanyiSlots
        .map((g) => `${g.startTime} · ${g.paxTotal} pax`)
        .join(" · ")}`,
    );
  if (board.pendingNoTime.length)
    avisos.push(`${board.pendingNoTime.length} reserva(s) sin hora — pendiente de franja`);
  if (board.unassigned.length)
    avisos.push(`${board.unassigned.length} reserva(s) sin asignar a salida`);
  if (board.cashPending > 0)
    avisos.push(`${board.cashPending} importe(s) de caja pendientes`);
  if (board.stats.failedEmails > 0)
    avisos.push(`${board.stats.failedEmails} email(s) que no se pudieron leer (revísalos en Emails)`);

  const resumenItems = [
    { label: "Total pax", value: board.resumen.paxTotal },
    { label: "Kayak", value: board.resumen.kayak },
    { label: "Paddle", value: board.resumen.paddle },
    { label: "Santanyí", value: board.resumen.santanyi },
    { label: "Caja €", value: Math.round(board.cashTotal) },
    { label: "Países", value: board.resumen.countries },
  ];

  return (
    <div className="space-y-4 -m-4 p-4" style={{ background: BOARD_BG, fontFamily: "system-ui" }}>
      <AutoRefresh seconds={30} />

      {/* Cabecera */}
      <header className="flex flex-wrap items-center gap-3">
        <div>
          <p className="text-sm font-bold tracking-wide text-slate-500">Secret Point Mallorca</p>
          <h1 className="text-xl font-bold capitalize leading-tight">{formatDateEs(date)}</h1>
        </div>
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
          <a
            href={`/cuadro/${date}/pdf`}
            className="px-3 py-1.5 rounded-lg bg-slate-800 text-white text-sm font-semibold hover:bg-slate-900"
          >
            ⬇ PDF
          </a>
          <PrintButton />
        </div>
      </header>

      {/* Stats (instructivo §4) */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Total pax" value={String(board.stats.paxTotal)} sub={`${board.stats.paxAdults} adultos + ${board.stats.paxChildren} niños`} />
        <Stat label="Caja efectivo" value={board.cashPending > 0 ? `${formatEuro(board.cashTotal)}+` : formatEuro(board.cashTotal)} sub={board.cashPending > 0 ? `${board.cashPending} pdte. confirmar` : "confirmada"} accent={board.cashPending > 0 ? "amber" : undefined} />
        <Stat label="Franjas llenas" value={String(board.stats.fullSlots)} sub={board.stats.splitSlots > 0 ? `${board.stats.splitSlots} a dividir` : "sin desbordes"} accent={board.stats.splitSlots > 0 ? "red" : undefined} />
        <Stat label="Excursiones" value={String(board.stats.excursions)} sub={board.stats.channels.join(" · ") || "—"} />
      </section>

      {/* Aviso operativo */}
      {avisos.length > 0 && (
        <section className="print-block rounded-xl border-l-4 border-amber-500 bg-amber-50 px-4 py-3">
          <h2 className="text-sm font-bold text-amber-800 mb-1">⚠ Aviso operativo</h2>
          <ul className="text-sm text-amber-900 space-y-0.5 list-disc pl-5">
            {avisos.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Meteo */}
      {weather && weather.some((w) => w.tempC != null || w.windKmh != null) && (
        <section className="print-block bg-sky-50 border border-sky-200 rounded-xl px-3 py-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <span className="font-semibold text-sky-800">🌤 Meteo</span>
          {weather.map((w) => (
            <WeatherChip key={w.hour} w={w} />
          ))}
        </section>
      )}

      {/* Caja del día */}
      <section className="print-block bg-white rounded-xl shadow-sm border border-slate-200 p-3 space-y-2">
        <h2 className="font-bold">💶 CAJA DEL DÍA — Efectivo</h2>
        {board.cashEntries.length === 0 ? (
          <p className="text-sm text-slate-400">Sin movimientos de efectivo (GYG/Viator/Freedome ya cobrados)</p>
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
              <tr className="font-bold border-t border-slate-300">
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
        <p className="text-xs text-slate-400">
          Solo efectivo cobrado en playa (Hotel 45/25 · Directa/WhatsApp/Instagram/Privada 40/20).
        </p>
      </section>

      {/* Sin asignar (con hora) */}
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

      {/* Pendiente de franja (sin hora) */}
      {board.pendingNoTime.length > 0 && (
        <section className="print-block bg-orange-50 border border-orange-300 rounded-xl p-3 space-y-2">
          <h2 className="font-semibold text-orange-800 text-sm">
            ⏳ Pendiente de franja — sin hora en el email
          </h2>
          {board.pendingNoTime.map((b) => (
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

      {/* Cuadro por playa (Santanyí primero) */}
      {board.locations
        .filter((loc) => !loc.isSantanyi || loc.paxTotal > 0)
        .map((loc) => (
          <section key={loc.locationId} className="space-y-3">
            <h2 className="text-xs font-bold tracking-widest text-slate-400 uppercase">
              📍 {loc.name} · {loc.paxTotal} pax{loc.isSantanyi ? " · monitor aparte" : ""}
            </h2>
            {loc.groups.map((g) => (
              <SlotCard key={g.timeSlotId ?? g.departureId} g={g} date={date} />
            ))}
          </section>
        ))}

      {/* Gráfico de barras */}
      {board.chart.length > 0 && (
        <section className="print-block bg-white rounded-xl shadow-sm border border-slate-200 p-3">
          <h2 className="font-bold mb-2">Personas por franja</h2>
          <BoardChart bars={board.chart} />
        </section>
      )}

      {/* Resumen visual */}
      <section className="print-block bg-white rounded-xl shadow-sm border border-slate-200 p-3 space-y-3">
        <h2 className="font-bold">Resumen del día</h2>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {resumenItems.map((r) => (
            <div key={r.label} className="rounded-lg bg-slate-50 border border-slate-200 p-2 text-center">
              <p className="text-lg font-bold">{r.value}</p>
              <p className="text-xs text-slate-400">{r.label}</p>
            </div>
          ))}
        </div>
        <table className="w-full text-sm">
          <tbody>
            {board.locations.flatMap((l) =>
              l.groups
                .filter((g) => g.paxTotal > 0)
                .map((g) => (
                  <tr key={g.timeSlotId ?? g.departureId} className="border-b border-dashed border-slate-200">
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
        <p className="text-xs text-slate-400">
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

// ── Tarjeta de franja ──────────────────────────────────────────────────

function SlotCard({ g, date }: { g: BoardSlotGroup; date: string }) {
  return (
    <div className="slot-card bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-slate-100">
        <span className="font-bold text-lg">{g.startTime}</span>
        <BadgeChip badge={{ label: g.productName, bg: "#EEF1F4", fg: "#334155" }} />
        {g.channelBadges.map((b) => (
          <BadgeChip key={b.label} badge={b} />
        ))}
        {g.needsMonitor && <BadgeChip badge={MONITOR_BADGE} />}
        {g.isAdHoc && (
          <span className="text-xs font-bold text-sky-600" title="Salida creada automáticamente">EXTRA</span>
        )}
        {g.isDouble && <span className="text-xs font-bold text-red-600">DOBLE SALIDA</span>}
        <div className="ml-auto flex items-center gap-2">
          <span className="font-bold tabular-nums" style={{ color: g.overbookedBy > 0 ? g.colorHex : "#334155" }}>
            {g.paxTotal}/{g.capacity}
            {g.overbookedBy > 0 && ` · +${g.overbookedBy}`}
          </span>
          <form
            action={
              g.timeSlotId
                ? toggleDoubleDeparture.bind(null, g.timeSlotId, date)
                : toggleDoubleAdHoc.bind(null, g.departureId!, date)
            }
            className="no-print"
          >
            <button className="text-xs px-2 py-1 rounded border border-slate-300 text-slate-500 hover:bg-slate-100" title="Duplicar cupo (doble salida)">
              {g.isDouble ? "quitar doble" : "doble salida"}
            </button>
          </form>
        </div>
      </div>
      {/* Barra de cupo coloreada (umbral por nº de personas) */}
      {g.paxTotal > 0 && <CapacityBar g={g} />}
      {g.bookings.length === 0 ? (
        <p className="px-3 py-2 text-sm text-slate-400">Sin reservas</p>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {g.bookings.map((b) => (
              <BookingRow key={b.id} b={b} date={date} />
            ))}
          </tbody>
        </table>
      )}
      {g.bookings.length > 0 && (
        <div className="px-3 py-1.5 text-xs bg-slate-50 flex justify-between">
          <span className="text-slate-500">
            Total: {g.paxAdults} adultos{g.paxChildren > 0 ? ` + ${g.paxChildren} niños` : ""}
            {g.needsSplit && <strong style={{ color: g.colorHex }}> · dividir en varias salidas</strong>}
          </span>
          <span className="font-semibold" style={{ color: g.overbookedBy > 0 ? g.colorHex : "#059669" }}>
            {g.overbookedBy > 0 ? `Exceso: +${g.overbookedBy}` : `Libre: ${g.free}`}
          </span>
        </div>
      )}
    </div>
  );
}

function CapacityBar({ g }: { g: BoardSlotGroup }) {
  const pct = Math.min(100, Math.round((g.paxTotal / Math.max(1, g.capacity)) * 100));
  return (
    <div className="px-3 pt-2">
      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: g.colorHex }} />
      </div>
    </div>
  );
}

function BookingRow({ b, date }: { b: Booking; date: string }) {
  return (
    <tr className="border-b border-slate-50 last:border-0">
      <td className="px-3 py-1.5 font-bold w-10 tabular-nums">{b.paxAdults + b.paxChildren}</td>
      <td className="px-2 py-1.5">
        {b.customerName ?? "—"}
        {b.paxChildren > 0 && (
          <span className="text-xs font-semibold" style={{ color: CHILD_COLOR }}>
            {" "}· {b.paxChildren} niño{b.paxChildren > 1 ? "s" : ""}
          </span>
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
  );
}

function BadgeChip({ badge }: { badge: Badge }) {
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ background: badge.bg, color: badge.fg }}
    >
      {badge.label}
    </span>
  );
}

function WeatherChip({ w }: { w: HourWeather }) {
  const gustAlert = w.gustKmh != null && w.gustKmh >= 35;
  const waveAlert = w.waveM != null && w.waveM >= 1;
  return (
    <span className="whitespace-nowrap">
      <strong>{w.hour}</strong>{" "}
      {w.tempC != null && <span>{Math.round(w.tempC)}º</span>}{" "}
      {w.windKmh != null && (
        <span className={gustAlert ? "text-red-600 font-semibold" : ""}>
          💨{Math.round(w.windKmh)}
          {w.gustKmh != null && `(${Math.round(w.gustKmh)})`} km/h
        </span>
      )}{" "}
      {w.waveM != null && (
        <span className={waveAlert ? "text-red-600 font-semibold" : ""}>🌊{w.waveM.toFixed(1)} m</span>
      )}
      {w.precipProb != null && w.precipProb >= 30 && <span> ☔{w.precipProb}%</span>}
    </span>
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
  if (b.paymentKind === "platform") return <span className="text-emerald-600" title="Cobrado por plataforma">✓ pagado</span>;
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
