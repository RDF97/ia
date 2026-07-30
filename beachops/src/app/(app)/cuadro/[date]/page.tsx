import Link from "next/link";
import { notFound } from "next/navigation";
import {
  assignBooking,
  cancelBooking,
  confirmCashEntry,
  updateBookingNotes,
  toggleDoubleAdHoc,
  toggleDoubleDeparture,
} from "@/server/actions";
import { requireSession } from "@/server/auth";
import { getBoard, BoardSlotGroup } from "@/server/board/query";
import { Badge, BOARD_BG, CHILD_COLOR, MONITOR_BADGE } from "@/server/board/rules";
import { getDb, schema } from "@/server/db";
import { Booking } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { flagEmoji, formatDateEs, formatDateShortEs, formatEuro, shiftDate } from "@/lib/format";
import { getDayWeather, orgCoords, HourWeather } from "@/server/weather";
import { SubmitButton } from "@/components/submit-button";
import { AutoRefresh } from "./auto-refresh";
import { PrintButton } from "./print-button";
import { PdfButton } from "./pdf-button";
import { BookingEmailLink } from "./booking-email";
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
  // Playas activas: para poder asignar a mano una hora en la playa que toque.
  const locations = (
    await db.select().from(schema.locations).where(eq(schema.locations.orgId, session.orgId))
  )
    .filter((l) => l.active)
    .sort((a, b) => a.sortOrder - b.sortOrder);
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
  // Si el correo deja de entrar, el cuadro se queda "congelado" sin que se note:
  // avisarlo aquí es lo que evita días sin reservas nuevas.
  if (board.sync.staleMinutes != null && board.sync.staleMinutes > 120) {
    const horas = Math.floor(board.sync.staleMinutes / 60);
    avisos.push(
      `⛔ El correo no se sincroniza desde hace ${horas >= 24 ? `${Math.floor(horas / 24)} día(s)` : `${horas} h`}` +
        (board.sync.error ? ` — ${board.sync.error.slice(0, 120)}` : "") +
        " · revisa Configuración",
    );
  }

  const resumenItems = [
    { label: "Total pax", value: board.resumen.paxTotal },
    { label: "Kayak", value: board.resumen.kayak },
    { label: "Paddle", value: board.resumen.paddle },
    { label: "Santanyí", value: board.resumen.santanyi },
    { label: "Caja €", value: Math.round(board.cashTotal) },
    { label: "Países", value: board.resumen.countries },
  ];

  return (
    // board-flow: en el móvil las reservas suben justo debajo de los avisos
    // (es lo que se consulta en la playa); caja, gráfico y resumen bajan. En
    // escritorio e impresión se respeta el orden del instructivo.
    <div
      className="board-flow -m-3 flex flex-col gap-3 p-3 md:-m-4 md:gap-4 md:p-4"
      style={{ background: BOARD_BG }}
    >
      <AutoRefresh seconds={30} />

      {/* Cabecera: título grande y navegación de fecha al alcance del pulgar */}
      <header className="order-1 space-y-2.5 md:order-none">
        <div className="flex items-center gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Secret Point Mallorca
            </p>
            {/* Fecha corta en el móvil (cabe entera) y completa en escritorio */}
            <h1 className="text-2xl font-bold leading-tight md:text-xl">
              <span className="md:hidden">{formatDateShortEs(date)}</span>
              <span className="hidden md:inline">{formatDateEs(date)}</span>
            </h1>
          </div>
          <Link
            href={`/reservas/nueva?date=${date}`}
            className="tap no-print ml-auto inline-flex shrink-0 items-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm active:bg-blue-700"
          >
            + Reserva
          </Link>
        </div>
        <div className="no-print flex items-center gap-2">
          <Link
            href={`/cuadro/${shiftDate(date, -1)}`}
            aria-label="Día anterior"
            className="tap inline-flex flex-1 items-center justify-center rounded-xl border border-slate-300 bg-white py-2.5 text-lg active:bg-slate-100 md:flex-none md:px-4"
          >
            ←
          </Link>
          <Link
            href="/"
            className="tap inline-flex flex-1 items-center justify-center rounded-xl border border-slate-300 bg-white py-2.5 text-sm font-semibold active:bg-slate-100 md:flex-none md:px-4"
          >
            Hoy
          </Link>
          <Link
            href={`/cuadro/${shiftDate(date, 1)}`}
            aria-label="Día siguiente"
            className="tap inline-flex flex-1 items-center justify-center rounded-xl border border-slate-300 bg-white py-2.5 text-lg active:bg-slate-100 md:flex-none md:px-4"
          >
            →
          </Link>
          <div className="ml-auto flex gap-2">
            <PdfButton date={date} />
            <span className="hidden md:inline-flex">
              <PrintButton />
            </span>
          </div>
        </div>
      </header>

      {/* Stats (instructivo §4) */}
      <section className="order-2 grid grid-cols-4 gap-2 md:order-none md:gap-3">
        <Stat label="Total pax" short="Pax" value={String(board.stats.paxTotal)} sub={`${board.stats.paxAdults} adultos + ${board.stats.paxChildren} niños`} />
        <Stat label="Caja efectivo" short="Caja" value={board.cashPending > 0 ? `${formatEuro(board.cashTotal)}+` : formatEuro(board.cashTotal)} sub={board.cashPending > 0 ? `${board.cashPending} pdte. confirmar` : "confirmada"} accent={board.cashPending > 0 ? "amber" : undefined} />
        <Stat label="Franjas llenas" short="Llenas" value={String(board.stats.fullSlots)} sub={board.stats.splitSlots > 0 ? `${board.stats.splitSlots} a dividir` : "sin desbordes"} accent={board.stats.splitSlots > 0 ? "red" : undefined} />
        <Stat label="Excursiones" short="Salidas" value={String(board.stats.excursions)} sub={board.stats.channels.join(" · ") || "—"} />
      </section>

      {/* Aviso operativo */}
      {avisos.length > 0 && (
        <section className="order-3 print-block rounded-xl border-l-4 border-amber-500 bg-amber-50 px-4 py-3 md:order-none">
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
        // Meteo en una tira que se desliza: informa sin comerse la pantalla
        <section className="order-7 print-block rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm md:order-none">
          <div className="momentum flex gap-4 overflow-x-auto md:flex-wrap md:gap-x-5">
            <span className="shrink-0 font-semibold text-sky-800">🌤 Meteo</span>
            {weather.map((w) => (
              <WeatherChip key={w.hour} w={w} />
            ))}
          </div>
        </section>
      )}

      {/* Caja del día */}
      <section className="order-8 print-block bg-white rounded-xl shadow-sm border border-slate-200 p-3 space-y-2 md:order-none">
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
                        <SubmitButton className="text-xs px-2 py-0.5 rounded bg-emerald-600 text-white" pendingLabel="…" doneLabel="✓">
                          confirmar
                        </SubmitButton>
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
        <section className="order-4 print-block bg-amber-50 border border-amber-300 rounded-xl p-3 space-y-2 md:order-none">
          <h2 className="font-semibold text-amber-800 text-sm">
            ⚠ Reservas sin asignar a franja — elige salida
          </h2>
          {board.unassigned.map((b) => (
            <div key={b.id} className="flex flex-wrap items-center gap-2 text-sm bg-white rounded-lg p-2">
              <BookingCells b={b} date={date} />
              <form action={assignBooking.bind(null, b.id)} className="no-print w-full">
                <SlotSelect
                  slots={slots.map((s) => ({ id: s.id, label: `${s.startTime.slice(0, 5)} · ${productName(s.productId)}` }))}
                  locations={locations.map((l) => ({ id: l.id, name: l.name }))}
                  date={date}
                />
              </form>
            </div>
          ))}
        </section>
      )}

      {/* Pendiente de franja (sin hora) */}
      {board.pendingNoTime.length > 0 && (
        <section className="order-5 print-block bg-orange-50 border border-orange-300 rounded-xl p-3 space-y-2 md:order-none">
          <h2 className="font-semibold text-orange-800 text-sm">
            ⏳ Pendiente de franja — sin hora en el email
          </h2>
          {board.pendingNoTime.map((b) => (
            <div key={b.id} className="flex flex-wrap items-center gap-2 text-sm bg-white rounded-lg p-2">
              <BookingCells b={b} date={date} />
              <form action={assignBooking.bind(null, b.id)} className="no-print w-full">
                <SlotSelect
                  slots={slots.map((s) => ({ id: s.id, label: `${s.startTime.slice(0, 5)} · ${productName(s.productId)}` }))}
                  locations={locations.map((l) => ({ id: l.id, name: l.name }))}
                  date={date}
                />
              </form>
            </div>
          ))}
        </section>
      )}

      {/* Cuadro por playa (Santanyí primero) */}
      {board.locations
        // Cada playa con reservas sale en su propia sección; la principal
        // siempre, aunque esté vacía.
        .filter((loc) => loc.paxTotal > 0 || loc.isDefault)
        .map((loc) => (
          <section key={loc.locationId} className="order-6 space-y-2.5 md:order-none">
            {/* Cabecera de playa con su color: separa de un vistazo cada playa */}
            <div
              className="flex items-center gap-2 rounded-xl px-3 py-2"
              style={{
                background: loc.color.bg,
                color: loc.color.fg,
                borderLeft: `5px solid ${loc.color.accent}`,
              }}
            >
              <h2 className="text-base font-bold leading-tight">📍 {loc.name}</h2>
              <span className="ml-auto whitespace-nowrap text-sm font-semibold">
                {loc.paxTotal} pax
              </span>
            </div>
            {loc.isSantanyi && loc.paxTotal > 0 && (
              <p className="px-1 text-xs font-semibold" style={{ color: loc.color.fg }}>
                ⚓ Monitor independiente
              </p>
            )}

            {/* Solo las franjas con reservas: el cuadro se lee de un tirón */}
            {loc.activeGroups.map((g) => (
              <SlotCard key={g.timeSlotId ?? g.departureId} g={g} date={date} accent={loc.color.accent} />
            ))}
            {loc.activeGroups.length === 0 && (
              <p className="px-1 text-sm text-slate-400">Sin reservas en esta playa</p>
            )}

            {/* Las vacías quedan a un toque, sin ocupar sitio */}
            {loc.emptyGroups.length > 0 && (
              <details className="no-print group">
                <summary className="tap-sm inline-flex cursor-pointer list-none items-center gap-1.5 rounded-lg px-1 text-xs font-medium text-slate-500 active:text-slate-800">
                  <span className="transition-transform group-open:rotate-90">▸</span>
                  {loc.emptyGroups.length} franja{loc.emptyGroups.length > 1 ? "s" : ""} sin reservas
                </summary>
                <div className="mt-2 space-y-2">
                  {loc.emptyGroups.map((g) => (
                    <SlotCard key={g.timeSlotId ?? g.departureId} g={g} date={date} accent={loc.color.accent} />
                  ))}
                </div>
              </details>
            )}
          </section>
        ))}

      {/* Gráfico de barras */}
      {board.chart.length > 0 && (
        <section className="order-9 print-block bg-white rounded-xl shadow-sm border border-slate-200 p-3 md:order-none">
          <h2 className="font-bold mb-2">Personas por franja</h2>
          <BoardChart bars={board.chart} />
        </section>
      )}

      {/* Resumen visual */}
      <section className="order-10 print-block bg-white rounded-xl shadow-sm border border-slate-200 p-3 space-y-3 md:order-none">
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
        <section className="order-11 no-print text-xs text-slate-400 md:order-none">
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

function SlotCard({ g, date, accent }: { g: BoardSlotGroup; date: string; accent?: string }) {
  return (
    <div
      className="slot-card overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      // Filo del color de la playa: ata la tarjeta a su sección de un vistazo
      style={accent ? { borderLeft: `5px solid ${accent}` } : undefined}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 px-3 py-2.5 border-b border-slate-100">
        {/* La hora es lo que más se busca de un vistazo: tamaño grande */}
        <span className="text-2xl font-bold leading-none tabular-nums">{g.startTime}</span>
        <span
          className="ml-auto text-xl font-bold tabular-nums"
          style={{ color: g.overbookedBy > 0 ? g.colorHex : "#334155" }}
        >
          {g.paxTotal}/{g.capacity}
          {g.overbookedBy > 0 && <span className="text-sm"> +{g.overbookedBy}</span>}
        </span>
        <div className="flex w-full flex-wrap items-center gap-1.5">
          <BadgeChip badge={{ label: g.productName, bg: "#EEF1F4", fg: "#334155" }} />
          {g.channelBadges.map((b) => (
            <BadgeChip key={b.label} badge={b} />
          ))}
          {g.needsMonitor && <BadgeChip badge={MONITOR_BADGE} />}
          {g.isAdHoc && (
            <BadgeChip badge={{ label: "EXTRA", bg: "#E0F2FE", fg: "#0369A1" }} />
          )}
          {g.isDouble && <BadgeChip badge={{ label: "DOBLE SALIDA", bg: "#FEE2E2", fg: "#B91C1C" }} />}
          <form
            action={
              g.timeSlotId
                ? toggleDoubleDeparture.bind(null, g.timeSlotId, date)
                : toggleDoubleAdHoc.bind(null, g.departureId!, date)
            }
            className="no-print ml-auto"
          >
            <SubmitButton
              className="tap-sm rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-600 active:bg-slate-100"
              pendingLabel="…"
              doneLabel="✓"
              title="Duplicar cupo (doble salida)"
            >
              {g.isDouble ? "quitar doble" : "doble salida"}
            </SubmitButton>
          </form>
        </div>
      </div>
      {/* Barra de cupo coloreada (umbral por nº de personas) */}
      {g.paxTotal > 0 && <CapacityBar g={g} />}
      {g.bookings.length === 0 ? (
        <p className="px-3 py-3 text-sm text-slate-400">Sin reservas</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {g.bookings.map((b) => (
            <BookingRow key={b.id} b={b} date={date} />
          ))}
        </ul>
      )}
      {g.bookings.length > 0 && (
        <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 bg-slate-50 px-3 py-2 text-xs">
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

/**
 * Fila de reserva pensada para el pulgar: pax grande a la izquierda, nombre
 * tocable (abre su email) y, debajo, teléfono como botón de llamada. En
 * pantallas anchas todo se reparte en una sola línea.
 */
function BookingRow({ b, date }: { b: Booking; date: string }) {
  const pax = b.paxAdults + b.paxChildren;
  return (
    <li className="flex items-start gap-3 px-3 py-2.5">
      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-base font-bold tabular-nums">
        {pax}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-[15px] font-semibold leading-tight">
            <BookingEmailLink bookingId={b.id} label={b.customerName ?? "(sin nombre)"} />
          </span>
          {b.customerCountry && (
            <span title={b.customerCountry}>{flagEmoji(b.customerCountry)}</span>
          )}
          {b.paxChildren > 0 && (
            <span className="text-xs font-semibold" style={{ color: CHILD_COLOR }}>
              {b.paxChildren} niño{b.paxChildren > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
          {b.customerPhone && (
            <a
              href={`tel:${b.customerPhone}`}
              className="tap-sm inline-flex items-center gap-1 font-medium text-blue-600 active:text-blue-800"
            >
              📞 {b.customerPhone}
            </a>
          )}
          {b.pickupHotel && <span>Hotel {b.pickupHotel}</span>}
          <span className="font-mono text-[11px] text-slate-400">{b.externalRef ?? b.channel}</span>
        </div>
        {/* Nota del equipo: se ve siempre, es lo que el monitor necesita leer */}
        {b.staffNotes && (
          <p className="mt-1 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-900">
            📝 {b.staffNotes}
          </p>
        )}
        <details className="no-print mt-1">
          <summary className="tap-sm inline-flex cursor-pointer list-none text-[11px] text-slate-400 active:text-slate-700">
            {b.staffNotes ? "editar nota" : "+ nota"}
          </summary>
          <form
            action={updateBookingNotes.bind(null, b.id, date)}
            className="mt-1 flex items-center gap-1"
          >
            <input
              name="staffNotes"
              defaultValue={b.staffNotes ?? ""}
              placeholder="Ej.: lleva niño pequeño, recoger en hotel…"
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            />
            <SubmitButton className="tap-sm rounded-lg bg-slate-700 px-2.5 py-1.5 text-xs text-white" pendingLabel="…" doneLabel="✓">
              guardar
            </SubmitButton>
          </form>
        </details>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <span className="whitespace-nowrap text-right text-sm">
          <PaymentBadge b={b} />
        </span>
        <form action={cancelBooking.bind(null, b.id, date)} className="no-print">
          <SubmitButton
            className="tap-sm w-9 justify-center rounded-lg text-slate-300 active:bg-red-50 active:text-red-600"
            pendingLabel="…"
            doneLabel="✓"
            title="Cancelar reserva"
          >
            ✕
          </SubmitButton>
        </form>
      </div>
    </li>
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
    <span className="shrink-0 whitespace-nowrap">
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

function Stat({
  label,
  short,
  value,
  sub,
  accent,
}: {
  label: string;
  /** Etiqueta corta para el móvil, donde no cabe la larga */
  short?: string;
  value: string;
  sub?: string;
  accent?: "red" | "amber";
}) {
  const color = accent === "red" ? "text-red-600" : accent === "amber" ? "text-amber-600" : "text-slate-900";
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm md:p-3">
      <p className="truncate text-[11px] leading-tight text-slate-400 md:text-xs">
        <span className="md:hidden">{short ?? label}</span>
        <span className="hidden md:inline">{label}</span>
      </p>
      <p className={`text-xl font-bold leading-tight md:text-2xl ${color}`}>{value}</p>
      {/* En el móvil el detalle sobra: las alertas ya salen en el aviso operativo */}
      {sub && <p className="hidden text-xs leading-tight text-slate-500 md:block">{sub}</p>}
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
      <BookingEmailLink bookingId={b.id} label={b.customerName ?? "(ver email)"} />
      <span className="text-slate-400">{b.activityTime?.slice(0, 5) ?? date}</span>
      <span className="text-xs text-slate-400 font-mono">{b.externalRef}</span>
      <span className="text-xs text-slate-500 max-w-60 truncate">{b.rawProductName}</span>
    </>
  );
}

/** Horas cada 30 minutos, para asignar una reserva a una hora que no está en la plantilla. */
const HALF_HOURS = Array.from({ length: 27 }, (_, i) => {
  const minutes = 8 * 60 + i * 30; // de 08:00 a 21:00
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${minutes % 60 === 0 ? "00" : "30"}`;
});

/**
 * Asignación de una reserva sin franja: o una franja de la plantilla, o una hora
 * a mano en pasos de 30 min (con su playa), más una nota opcional.
 */
function SlotSelect({
  slots,
  locations,
  date,
}: {
  slots: { id: string; label: string }[];
  locations: { id: string; name: string }[];
  date: string;
}) {
  const field = "rounded-lg border border-slate-300 px-2 py-2 text-sm";
  return (
    <div className="w-full space-y-1.5">
      <input type="hidden" name="date" value={date} />
      <div className="flex flex-wrap items-center gap-1.5">
        <select name="timeSlotId" className={`${field} min-w-0 flex-1`} defaultValue="">
          <option value="">— franja de la plantilla —</option>
          {slots.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-slate-500">o a esta hora</span>
        <select name="manualTime" className={field} defaultValue="">
          <option value="">--:--</option>
          {HALF_HOURS.map((h) => (
            <option key={h} value={h}>{h}</option>
          ))}
        </select>
        <select name="locationId" className={`${field} min-w-0 flex-1`} defaultValue={locations[0]?.id ?? ""}>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-1.5">
        <input
          name="staffNotes"
          placeholder="Nota (opcional)"
          className={`${field} min-w-0 flex-1`}
        />
        <SubmitButton
          className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white"
          pendingLabel="…"
          doneLabel="✓"
        >
          asignar
        </SubmitButton>
      </div>
    </div>
  );
}
