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
import { getDb, schema } from "@/server/db";
import { Booking } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { flagEmoji, formatDateEs, formatEuro, shiftDate } from "@/lib/format";
import { getDayWeather, orgCoords, HourWeather } from "@/server/weather";
import { SubmitButton } from "@/components/submit-button";
import { AutoRefresh } from "./auto-refresh";
import { PrintButton } from "./print-button";
import { PdfButton } from "./pdf-button";
import { BookingEmailLink } from "./booking-email";
import { FilaReserva } from "./booking-row";
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
  const productName = (id: string | null) => products.find((p) => p.id === id)?.name ?? "—";

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

  // ── Avisos operativos (instructivo §4) ───────────────────────────────
  // Los que obligan a llamar o a mover gente van en rojo; el resto, en ámbar.
  const santanyiSlots = board.locations
    .filter((l) => l.isSantanyi)
    .flatMap((l) => l.groups.filter((g) => g.paxTotal > 0));
  const splitGroups = board.locations.flatMap((l) =>
    l.groups.filter((g) => g.needsSplit).map((g) => `${g.startTime} ${g.productName}`),
  );
  const soldOutGroups = board.locations.flatMap((l) =>
    l.groups.filter((g) => g.paxTotal > 0 && g.free === 0 && !g.needsSplit).map((g) => g.startTime),
  );

  const urgentes: string[] = [];
  const avisos: string[] = [];
  if (splitGroups.length)
    urgentes.push(`Dividir en varias salidas (≥16 pax): ${splitGroups.join(" · ")}`);
  // Si el correo deja de entrar, el cuadro se queda "congelado" sin que se note.
  if (board.sync.staleMinutes != null && board.sync.staleMinutes > 120) {
    const horas = Math.floor(board.sync.staleMinutes / 60);
    urgentes.push(
      `El correo no se sincroniza desde hace ${horas >= 24 ? `${Math.floor(horas / 24)} día(s)` : `${horas} h`}` +
        (board.sync.error ? ` — ${board.sync.error.slice(0, 120)}` : "") +
        " · revisa Configuración",
    );
  }
  if (board.stats.failedEmails > 0)
    urgentes.push(`${board.stats.failedEmails} email(s) que no se pudieron leer · revísalos en Emails`);
  if (soldOutGroups.length)
    avisos.push(`Franjas al completo: ${[...new Set(soldOutGroups)].join(" · ")}`);
  if (santanyiSlots.length)
    avisos.push(
      `Salida${santanyiSlots.length > 1 ? "s" : ""} de Cala Santanyí con monitor aparte: ${santanyiSlots
        .map((g) => `${g.startTime} · ${g.paxTotal} pax`)
        .join(" · ")}`,
    );
  if (board.pendingNoTime.length)
    avisos.push(`${board.pendingNoTime.length} reserva(s) sin hora — pendiente de franja`);
  if (board.unassigned.length)
    avisos.push(`${board.unassigned.length} reserva(s) sin asignar a salida`);
  if (board.cashPending > 0)
    avisos.push(`${board.cashPending} importe(s) de caja pendientes de confirmar`);

  const slotOptions = slots.map((s) => ({
    id: s.id,
    label: `${s.startTime.slice(0, 5)} · ${productName(s.productId)}`,
  }));
  const locationOptions = locations.map((l) => ({ id: l.id, name: l.name }));
  const desglose = board.locations.flatMap((l) =>
    l.groups
      .filter((g) => g.paxTotal > 0)
      .map((g) => ({ key: `${l.locationId}-${g.timeSlotId ?? g.departureId}`, loc: l.name, g })),
  );

  return (
    <div className="cuadro -m-3 min-h-full p-3 md:-m-4 md:p-4">
      <AutoRefresh seconds={30} />

      {/* 1. Barra superior */}
      <div className="topbar">
        <div className="topbar-left">
          <span className="brand">Secret Point Mallorca</span>
          <span className="date-pill">📅 {formatDateEs(date)}</span>
        </div>
        <div className="topbar-acc no-print">
          <Link href={`/cuadro/${shiftDate(date, -1)}`} className="btn-out" aria-label="Día anterior">
            ←
          </Link>
          <Link href="/" className="btn-out">
            Hoy
          </Link>
          <Link href={`/cuadro/${shiftDate(date, 1)}`} className="btn-out" aria-label="Día siguiente">
            →
          </Link>
          <PdfButton date={date} className="btn-out" />
          <PrintButton className="btn-out no-mobile" />
          <Link href={`/reservas/nueva?date=${date}`} className="btn-pri">
            + Reserva
          </Link>
        </div>
      </div>

      {/* 2. Estadísticas */}
      <div className="stats">
        <div className="stat">
          <div className="stat-lbl">Total pax</div>
          <div className="stat-val">{board.stats.paxTotal}</div>
          <div className="stat-sub">
            {board.stats.paxAdults} adultos + {board.stats.paxChildren} niños
          </div>
        </div>
        <div className="stat">
          <div className="stat-lbl">Caja efectivo</div>
          <div className="stat-val" style={board.cashPending > 0 ? { color: "#A37408" } : undefined}>
            {formatEuro(board.cashTotal)}
          </div>
          <div className="stat-sub">
            {board.cashPending > 0 ? `${board.cashPending} pendiente(s)` : "confirmada"}
          </div>
        </div>
        <div className="stat">
          <div className="stat-lbl">Franjas +cupo</div>
          <div
            className="stat-val"
            style={board.stats.splitSlots > 0 ? { color: "#A32D2D" } : undefined}
          >
            {board.stats.fullSlots}
          </div>
          <div className="stat-sub">
            {board.stats.splitSlots > 0 ? `${board.stats.splitSlots} a dividir` : "sin desbordes"}
          </div>
        </div>
        <div className="stat">
          <div className="stat-lbl">Excursiones</div>
          <div className="stat-val">{board.stats.excursions}</div>
          <div className="stat-sub">{board.stats.channels.join(" · ") || "—"}</div>
        </div>
      </div>

      {/* 3. Avisos */}
      {urgentes.length > 0 && (
        <div className="warn-box urgente print-block">
          <span>🔴</span>
          <ul>
            {urgentes.map((a, i) => (
              <li key={i}>
                <b>{a}</b>
              </li>
            ))}
          </ul>
        </div>
      )}
      {avisos.length > 0 && (
        <div className="warn-box print-block">
          <span>⚠️</span>
          <ul>
            {avisos.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}
      {weather && weather.some((w) => w.tempC != null || w.windKmh != null) && (
        <div className="meteo-box print-block">
          <span className="meteo-lbl">🌤 Meteo</span>
          {weather.map((w) => (
            <WeatherChip key={w.hour} w={w} />
          ))}
        </div>
      )}

      {/* 4. Caja del día */}
      <div className="caja-box print-block">
        <div className="caja-title">💶 CAJA DEL DÍA — Efectivo</div>
        {board.cashEntries.length === 0 ? (
          <div className="caja-row total">
            <span>Sin movimientos de efectivo</span>
            <span>0 €</span>
          </div>
        ) : (
          <>
            {board.cashEntries.map((c) => (
              <div key={c.id} className="caja-row">
                <span>{c.concept}</span>
                <span>
                  {c.amount == null ? "pendiente" : formatEuro(c.amount)}
                  {!c.confirmed && (
                    <form
                      action={confirmCashEntry.bind(null, c.id, date)}
                      className="caja-form no-print"
                    >
                      {c.amount == null && <input name="amount" placeholder="€" className="campo campo-mini" />}
                      <SubmitButton className="btn-mini" pendingLabel="…" doneLabel="✓">
                        confirmar
                      </SubmitButton>
                    </form>
                  )}
                </span>
              </div>
            ))}
            <div className="caja-row total">
              <span>TOTAL EFECTIVO {board.cashPending > 0 ? "(parcial)" : ""}</span>
              <span>
                {formatEuro(board.cashTotal)}
                {board.cashPending > 0 && " + pdte."}
              </span>
            </div>
          </>
        )}
        <div className="caja-nota">
          Solo efectivo cobrado en playa (Hotel 45/25 · Directa, WhatsApp, Instagram y Privada
          40/20). GetYourGuide, Viator y Freedome van cobrados por plataforma.
        </div>
      </div>

      {/* 5 + 6. Salidas por playa */}
      <div className="sec-lbl">📍 Salidas por playa</div>
      {board.locations
        // Cada playa con reservas sale en su propio bloque; la principal
        // siempre, aunque esté vacía.
        .filter((loc) => loc.paxTotal > 0 || loc.isDefault)
        .map((loc) => (
          <div key={loc.locationId} className="playa-wrap print-block">
            <div
              className="playa-hdr"
              style={{ background: loc.color.bg, color: loc.color.fg, borderLeft: `5px solid ${loc.color.accent}` }}
            >
              <span>
                🌊 {loc.name}
                {loc.isSantanyi && loc.paxTotal > 0 && " · ⚓ monitor aparte"}
              </span>
              <span className="resumen-zona" style={{ color: loc.color.fg }}>
                {loc.paxTotal} pax · {loc.activeGroups.filter((g) => g.paxTotal > 0).length} salida(s)
              </span>
            </div>

            {loc.activeGroups.map((g) => (
              <SlotBlock key={g.timeSlotId ?? g.departureId} g={g} date={date} />
            ))}
            {loc.activeGroups.length === 0 && (
              <div className="hora-foot">Sin reservas en esta playa</div>
            )}

            {/* Las franjas vacías quedan a un toque, sin ocupar sitio */}
            {loc.emptyGroups.length > 0 && (
              <details className="vacias no-print">
                <summary>
                  ▸ {loc.emptyGroups.length} franja{loc.emptyGroups.length > 1 ? "s" : ""} sin
                  reservas
                </summary>
                {loc.emptyGroups.map((g) => (
                  <SlotBlock key={g.timeSlotId ?? g.departureId} g={g} date={date} />
                ))}
              </details>
            )}
          </div>
        ))}

      {/* Reservas pendientes de colocar */}
      {board.unassigned.length > 0 && (
        <PendientesBlock
          title="⚠ Reservas sin asignar a franja"
          bookings={board.unassigned}
          date={date}
          slots={slotOptions}
          locations={locationOptions}
        />
      )}
      {board.pendingNoTime.length > 0 && (
        <PendientesBlock
          title="⏳ Pendiente de franja — el email no traía hora"
          bookings={board.pendingNoTime}
          date={date}
          slots={slotOptions}
          locations={locationOptions}
        />
      )}

      {/* 9. Resumen del día */}
      <div className="bloque-title">Resumen del día</div>
      <div className="resumen print-block">
        <div className="res-grid">
          <ResItem label="Total pax" value={board.resumen.paxTotal} sub={`${board.stats.paxAdults} adultos + ${board.stats.paxChildren} niños`} />
          <ResItem label="Kayak" value={board.resumen.kayak} sub="personas" />
          <ResItem label="Paddle Surf" value={board.resumen.paddle} sub="personas" />
          <ResItem
            label="Cala Santanyí"
            value={board.resumen.santanyi}
            sub={board.resumen.santanyi === 0 ? "sin salidas hoy" : "personas"}
            muted={board.resumen.santanyi === 0}
          />
          <ResItem label="Caja efectivo" value={formatEuro(board.cashTotal)} sub={`${board.cashEntries.length} cobro(s) en playa`} color={board.cashTotal > 0 ? "#A37408" : undefined} />
          <ResItem label="Países" value={board.resumen.countries} sub="nacionalidades distintas" />
        </div>
      </div>

      {/* 10. Gráfico */}
      {board.chart.length > 0 && (
        <>
          <div className="bloque-title">Distribución del día · personas por franja horaria</div>
          <div className="resumen print-block">
            <BoardChart bars={board.chart} />
            <div className="leyenda">
              <span>
                <i className="sw" style={{ background: "#639922" }} />
                &lt;10 pax
              </span>
              <span>
                <i className="sw" style={{ background: "#EF9F27" }} />
                10-15 pax
              </span>
              <span>
                <i className="sw" style={{ background: "#E24B4A" }} />≥16 pax · dividir
              </span>
            </div>
          </div>
        </>
      )}

      {/* 11. Desglose final */}
      <div className="desglose print-block">
        <div className="bloque-title">Desglose por franjas</div>
        {desglose.length === 0 && <div className="desglose-row">Sin salidas con reservas.</div>}
        {desglose.map(({ key, loc, g }) => (
          <div key={key} className="desglose-row">
            <span className="desglose-hora">{g.startTime}</span>
            <span>
              {g.paxTotal} pax · {loc} · {g.productName}
              {g.isDouble && " · doble salida"}
              {g.needsSplit && " · dividir"}
            </span>
          </div>
        ))}
        <div className="desglose-row total">
          <span>TOTAL DEL DÍA</span>
          <span>
            {board.stats.paxTotal} pax ({board.stats.paxAdults} ad. + {board.stats.paxChildren}{" "}
            niños)
          </span>
        </div>
        <div className="desglose-nota">
          Canales: {board.stats.channels.join(" · ") || "—"} · {board.stats.countries.length} países.
        </div>
      </div>

      {/* Canceladas */}
      {board.cancelled.length > 0 && (
        <div className="desglose no-print">
          <div className="bloque-title">Canceladas hoy</div>
          {board.cancelled.map((b) => (
            <div key={b.id} className="desglose-row" style={{ textDecoration: "line-through" }}>
              <span className="desglose-hora">{b.activityTime?.slice(0, 5) ?? "--:--"}</span>
              <span>
                {b.customerName ?? "(sin nombre)"} · {b.paxAdults + b.paxChildren} pax ·{" "}
                {b.externalRef}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Bloque de una franja horaria ───────────────────────────────────────

function SlotBlock({ g, date }: { g: BoardSlotGroup; date: string }) {
  const pct = Math.min(100, Math.round((g.paxTotal / Math.max(1, g.capacity)) * 100));
  const lvl = g.colorLevel === "green" ? "grn" : g.colorLevel === "amber" ? "amb" : "over-red";
  return (
    <div className="hora-block">
      <div className="hora-hdr">
        <div className="hora-left">
          <span className="hora-time">{g.startTime}</span>
          <span className={`badge ${productBadgeClass(g.productName)}`}>{g.productName}</span>
          {g.channelBadges.map((b) => (
            <span key={b.label} className={`badge ${channelBadgeClass(b.label)}`}>
              {b.label}
            </span>
          ))}
          {g.needsMonitor && <span className="badge bmon">⚓ Monitor aparte</span>}
          {g.isAdHoc && <span className="badge bsun">Extra</span>}
          {g.isDouble && <span className="badge bmon">Doble salida</span>}
          {g.needsSplit && <span className="over-badge">{g.paxTotal} · DIVIDIR</span>}
        </div>
        <div className="cupo-wrap">
          <div className="cupo-bar">
            <div className="cupo-fill" style={{ width: `${pct}%`, background: g.colorHex }} />
          </div>
          <span className={`cupo-txt ${g.paxTotal > 0 ? lvl : ""}`}>
            {g.paxTotal}/{g.capacity}
          </span>
        </div>
      </div>

      {g.bookings.length === 0 ? (
        <div className="sin-reservas">Sin reservas</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th className="col-pax">Pax</th>
              <th className="col-nom">Nombre</th>
              <th className="col-pais">
                <span className="no-mobile">País</span>
              </th>
              <th className="col-tel">Teléfono</th>
              <th className="col-ref">Referencia</th>
              <th className="col-pay">Pago</th>
            </tr>
          </thead>
          <tbody>
            {g.bookings.map((b) => (
              <FilaReserva
                key={b.id}
                bookingId={b.id}
                tint={rowTint(b.channel)}
                pax={b.paxAdults}
                nombre={b.customerName ?? "(sin nombre · ver email)"}
                flag={flagEmoji(b.customerCountry)}
                phone={b.customerPhone}
                reference={b.externalRef ?? b.channel}
                payment={<PaymentBadge b={b} />}
                childCount={b.paxChildren}
                note={b.staffNotes}
              >
                <Acciones b={b} date={date} />
              </FilaReserva>
            ))}
          </tbody>
        </table>
      )}

      <div className="hora-foot">
        <span>
          Total: <strong>{g.paxAdults} adultos</strong>
          {g.paxChildren > 0 && <strong> + {g.paxChildren} niños</strong>}
          {g.needsSplit && " · dividir en varias salidas"}
        </span>
        <span className="hora-foot-right">
          <span className={g.overbookedBy > 0 ? "over-red" : g.free === 0 ? "amb" : "grn"}>
            {g.overbookedBy > 0
              ? `+${g.overbookedBy} sobre cupo`
              : g.free === 0
                ? "sin plazas"
                : `Libre: ${g.free} plaza${g.free > 1 ? "s" : ""}`}
          </span>
          <form
            action={
              g.timeSlotId
                ? toggleDoubleDeparture.bind(null, g.timeSlotId, date)
                : toggleDoubleAdHoc.bind(null, g.departureId!, date)
            }
            className="no-print"
          >
            <SubmitButton
              className="btn-mini"
              pendingLabel="…"
              doneLabel="✓"
              title="Duplicar el cupo de esta franja"
            >
              {g.isDouble ? "quitar doble" : "doble salida"}
            </SubmitButton>
          </form>
        </span>
      </div>
    </div>
  );
}

/** Acciones por reserva: se despliegan al pulsar "⋯" en su fila. */
function Acciones({ b, date }: { b: Booking; date: string }) {
  return (
    <div className="acc-wrap">
      <form action={updateBookingNotes.bind(null, b.id, date)} className="acc-nota">
        <input
          name="staffNotes"
          defaultValue={b.staffNotes ?? ""}
          placeholder="Nota para el equipo (chaleco, hotel, alergias…)"
          className="campo"
        />
        <SubmitButton className="btn-pri" pendingLabel="…" doneLabel="✓">
          guardar nota
        </SubmitButton>
      </form>
      <form action={cancelBooking.bind(null, b.id, date)}>
        <SubmitButton className="btn-danger" pendingLabel="…" doneLabel="✓">
          cancelar reserva
        </SubmitButton>
      </form>
    </div>
  );
}

/** Reservas que hay que colocar a mano (sin franja o sin hora). */
function PendientesBlock({
  title,
  bookings,
  date,
  slots,
  locations,
}: {
  title: string;
  bookings: Booking[];
  date: string;
  slots: { id: string; label: string }[];
  locations: { id: string; name: string }[];
}) {
  return (
    <div className="playa-wrap pendientes print-block">
      <div className="playa-hdr">
        <span>{title}</span>
        <span className="resumen-zona">{bookings.length} reserva(s)</span>
      </div>
      {bookings.map((b) => (
        <div key={b.id} className="pend-row">
          <div className="pend-datos">
            <span className="pax-n">{b.paxAdults + b.paxChildren}</span>
            <strong>
              <BookingEmailLink bookingId={b.id} label={b.customerName ?? "(ver email)"} />
            </strong>
            <span>{flagEmoji(b.customerCountry)}</span>
            <span className="tel">{b.customerPhone}</span>
            <span className="ref">{b.externalRef ?? b.channel}</span>
            <span className="ref">{b.activityTime?.slice(0, 5) ?? "sin hora"}</span>
          </div>
          <form action={assignBooking.bind(null, b.id)} className="no-print">
            <SlotSelect slots={slots} locations={locations} date={date} />
          </form>
        </div>
      ))}
    </div>
  );
}

function ResItem({
  label,
  value,
  sub,
  color,
  muted,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  muted?: boolean;
}) {
  return (
    <div className="res-item">
      <div className="res-lbl">{label}</div>
      <div className="res-val" style={{ color: muted ? "#888780" : color }}>
        {value}
      </div>
      {sub && <div className="res-sub">{sub}</div>}
    </div>
  );
}

function WeatherChip({ w }: { w: HourWeather }) {
  const gustAlert = w.gustKmh != null && w.gustKmh >= 35;
  const waveAlert = w.waveM != null && w.waveM >= 1;
  return (
    <span className="meteo-chip">
      <strong>{w.hour}</strong>{" "}
      {w.tempC != null && <span>{Math.round(w.tempC)}º</span>}{" "}
      {w.windKmh != null && (
        <span className={gustAlert ? "over-red" : ""}>
          💨{Math.round(w.windKmh)}
          {w.gustKmh != null && `(${Math.round(w.gustKmh)})`} km/h
        </span>
      )}{" "}
      {w.waveM != null && (
        <span className={waveAlert ? "over-red" : ""}>🌊{w.waveM.toFixed(1)} m</span>
      )}
      {w.precipProb != null && w.precipProb >= 30 && <span> ☔{w.precipProb}%</span>}
    </span>
  );
}

function PaymentBadge({ b }: { b: Booking }) {
  if (b.paymentKind === "platform")
    return (
      <span className="pay-ok" title="Cobrado por la plataforma">
        ✓
      </span>
    );
  if (b.paymentKind === "cash" && b.cashAmount != null)
    return <span className="pay-pend">{formatEuro(b.cashAmount)}</span>;
  return (
    <span className="pay-pend" title="Importe pendiente de confirmar">
      ⏳
    </span>
  );
}

// ── Clases fijas del estándar visual (no son decorativas: identifican) ──

function productBadgeClass(name: string): string {
  return /paddle/i.test(name) ? "bp" : "bk";
}

function channelBadgeClass(label: string): string {
  const l = label.toLowerCase();
  if (l.includes("instagram")) return "binsta";
  if (l.includes("freedome")) return "bfree";
  if (l.includes("gyg") || l.includes("getyourguide") || l.includes("viator")) return "bv";
  if (l.includes("privada")) return "bn";
  return "bw";
}

/** Tinte de la fila según el canal de venta (cobro en playa). */
function rowTint(channel?: string | null): string | undefined {
  const c = (channel ?? "").trim().toLowerCase();
  if (c === "instagram") return "fila-insta";
  if (c === "hotel") return "fila-hotel";
  if (c === "directa" || c === "whatsapp" || c === "privada") return "fila-directa";
  return undefined;
}

/** Horas cada 30 minutos, para asignar una reserva a una hora fuera de plantilla. */
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
  return (
    <div className="asignar">
      <input type="hidden" name="date" value={date} />
      <select name="timeSlotId" className="campo" defaultValue="">
        <option value="">— franja de la plantilla —</option>
        {slots.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
      <div className="asignar-fila">
        <span className="asignar-lbl">o a esta hora</span>
        <select name="manualTime" className="campo campo-hora" defaultValue="">
          <option value="">--:--</option>
          {HALF_HOURS.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
        <select name="locationId" className="campo" defaultValue={locations[0]?.id ?? ""}>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>
      <div className="asignar-fila">
        <input name="staffNotes" placeholder="Nota (opcional)" className="campo" />
        <SubmitButton className="btn-pri" pendingLabel="…" doneLabel="✓">
          asignar
        </SubmitButton>
      </div>
    </div>
  );
}
