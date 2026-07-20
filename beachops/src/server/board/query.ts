import { and, eq } from "drizzle-orm";
import { getDb, schema } from "../db";
import { Booking, CashEntry } from "../db/schema";
import {
  Badge,
  ColorLevel,
  capacityHex,
  capacityLevel,
  channelBadge,
  isSantanyi as isSantanyiRule,
  needsSplit,
} from "./rules";

export type BoardSlotGroup = {
  /** null = salida extra (ad-hoc) sin franja de plantilla */
  timeSlotId: string | null;
  departureId: string | null;
  isAdHoc: boolean;
  startTime: string; // HH:MM
  productId: string | null;
  productName: string;
  productKind: string;
  capacity: number;
  isDouble: boolean;
  bookings: Booking[];
  paxAdults: number;
  paxChildren: number;
  paxTotal: number;
  free: number;
  overbookedBy: number;
  // Estándar visual (instructivo §3.5, §3.1)
  colorLevel: ColorLevel;
  colorHex: string;
  needsSplit: boolean;
  isSantanyi: boolean;
  needsMonitor: boolean;
  channelBadges: Badge[];
};

export type BoardLocation = {
  locationId: string;
  name: string;
  groups: BoardSlotGroup[];
  paxTotal: number;
  isSantanyi: boolean;
};

export type ChartBar = { hora: string; pax: number; hex: string };

export type Board = {
  date: string;
  locations: BoardLocation[];
  unassigned: Booking[];
  /** Reservas sin hora → "pendiente de franja" (instructivo §7). */
  pendingNoTime: Booking[];
  cancelled: Booking[];
  cashEntries: (CashEntry & { customerName: string | null })[];
  cashTotal: number;
  cashPending: number;
  chart: ChartBar[];
  resumen: {
    paxTotal: number;
    kayak: number;
    paddle: number;
    santanyi: number;
    countries: number;
  };
  stats: {
    paxTotal: number;
    paxAdults: number;
    paxChildren: number;
    excursions: number;
    fullSlots: number;
    overbookedSlots: number;
    splitSlots: number;
    pendingReview: number;
    failedEmails: number;
    channels: string[];
    countries: string[];
  };
};

function hhmm(t: string): string {
  return t.slice(0, 5);
}

/** Badges de canal distintos presentes en un grupo de reservas. */
function badgesFor(bookings: Booking[]): Badge[] {
  const seen = new Map<string, Badge>();
  for (const b of bookings) {
    const badge = channelBadge(b.channel, b.source);
    if (!seen.has(badge.label)) seen.set(badge.label, badge);
  }
  return [...seen.values()];
}

export async function getBoard(orgId: string, date: string): Promise<Board> {
  const db = await getDb();

  const [locations, products, slots, departures, dayBookings, cash, failedCount] =
    await Promise.all([
      db.select().from(schema.locations).where(eq(schema.locations.orgId, orgId)),
      db.select().from(schema.products).where(eq(schema.products.orgId, orgId)),
      db.select().from(schema.timeSlots).where(eq(schema.timeSlots.orgId, orgId)),
      db
        .select()
        .from(schema.departures)
        .where(and(eq(schema.departures.orgId, orgId), eq(schema.departures.date, date))),
      db
        .select()
        .from(schema.bookings)
        .where(and(eq(schema.bookings.orgId, orgId), eq(schema.bookings.activityDate, date))),
      db
        .select()
        .from(schema.cashEntries)
        .where(and(eq(schema.cashEntries.orgId, orgId), eq(schema.cashEntries.date, date))),
      db
        .select({ id: schema.rawEmails.id })
        .from(schema.rawEmails)
        .where(
          and(eq(schema.rawEmails.orgId, orgId), eq(schema.rawEmails.parseStatus, "failed")),
        ),
    ]);

  const productById = new Map(products.map((p) => [p.id, p]));
  const active = dayBookings.filter((b) => b.status !== "cancelled");
  const cancelled = dayBookings.filter((b) => b.status === "cancelled");

  function buildGroup(
    base: {
      timeSlotId: string | null;
      departureId: string | null;
      isAdHoc: boolean;
      startTime: string;
      productId: string | null;
      isDouble: boolean;
      capacity: number;
    },
    locationName: string,
    slotBookings: Booking[],
  ): BoardSlotGroup {
    const paxAdults = slotBookings.reduce((n, b) => n + b.paxAdults, 0);
    const paxChildren = slotBookings.reduce((n, b) => n + b.paxChildren, 0);
    const paxTotal = paxAdults + paxChildren;
    const product = base.productId ? productById.get(base.productId) : undefined;
    const santanyi = isSantanyiRule(locationName, product?.name);
    return {
      ...base,
      productName: product?.name ?? "—",
      productKind: product?.kind ?? "tour",
      bookings: slotBookings.sort((a, b) =>
        (a.customerName ?? "").localeCompare(b.customerName ?? ""),
      ),
      paxAdults,
      paxChildren,
      paxTotal,
      free: Math.max(0, base.capacity - paxTotal),
      overbookedBy: Math.max(0, paxTotal - base.capacity),
      colorLevel: capacityLevel(paxTotal),
      colorHex: capacityHex(paxTotal),
      needsSplit: needsSplit(paxTotal),
      isSantanyi: santanyi,
      needsMonitor: santanyi,
      channelBadges: badgesFor(slotBookings),
    };
  }

  const boardLocations: BoardLocation[] = locations
    .filter((l) => l.active)
    .map((loc) => {
      const groups: BoardSlotGroup[] = slots
        .filter((s) => s.active && s.locationId === loc.id)
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
        .map((slot) => {
          const departure = departures.find((d) => d.timeSlotId === slot.id) ?? null;
          const slotBookings = active.filter(
            (b) => b.departureId && departure && b.departureId === departure.id,
          );
          return buildGroup(
            {
              timeSlotId: slot.id,
              departureId: departure?.id ?? null,
              isAdHoc: false,
              startTime: hhmm(slot.startTime),
              productId: slot.productId,
              isDouble: departure?.isDouble ?? false,
              capacity: departure?.capacityOverride ?? slot.defaultCapacity,
            },
            loc.name,
            slotBookings,
          );
        });
      // Salidas "extra" (ad-hoc) de esta playa: creadas automáticamente al
      // llegar reservas con horas fuera de la plantilla.
      const adHocGroups: BoardSlotGroup[] = departures
        .filter((d) => !d.timeSlotId && d.locationId === loc.id)
        .map((d) =>
          buildGroup(
            {
              timeSlotId: null,
              departureId: d.id,
              isAdHoc: true,
              startTime: hhmm(d.startTime),
              productId: d.productId,
              isDouble: d.isDouble,
              capacity: d.capacityOverride ?? 12,
            },
            loc.name,
            active.filter((b) => b.departureId === d.id),
          ),
        );

      const allGroups = [...groups, ...adHocGroups].sort((a, b) =>
        a.startTime.localeCompare(b.startTime),
      );
      return {
        locationId: loc.id,
        name: loc.name,
        groups: allGroups,
        paxTotal: allGroups.reduce((n, g) => n + g.paxTotal, 0),
        isSantanyi: isSantanyiRule(loc.name),
      };
    })
    // Cala Santanyí primero (instructivo §4), luego el resto por sortOrder.
    .sort((a, b) => Number(b.isSantanyi) - Number(a.isSantanyi));

  const assignedIds = new Set(
    boardLocations.flatMap((l) => l.groups.flatMap((g) => g.bookings.map((b) => b.id))),
  );
  const unassignedAll = active.filter((b) => !assignedIds.has(b.id));
  // Sin hora → pendiente de franja; con hora pero sin salida → sin asignar.
  const pendingNoTime = unassignedAll.filter((b) => !b.activityTime);
  const unassigned = unassignedAll.filter((b) => b.activityTime);

  const bookingById = new Map(dayBookings.map((b) => [b.id, b]));
  const cashEntries = cash.map((c) => ({
    ...c,
    customerName: c.bookingId ? bookingById.get(c.bookingId)?.customerName ?? null : null,
  }));
  const cashTotal = cashEntries
    .filter((c) => c.amount != null)
    .reduce((n, c) => n + Number(c.amount), 0);
  const cashPending = cashEntries.filter((c) => c.amount == null || !c.confirmed).length;

  const paxAdults = active.reduce((n, b) => n + b.paxAdults, 0);
  const paxChildren = active.reduce((n, b) => n + b.paxChildren, 0);
  const paxTotal = paxAdults + paxChildren;

  // Gráfico: una barra por hora, sumando todas las actividades de esa hora.
  const byHour = new Map<string, number>();
  for (const loc of boardLocations) {
    for (const g of loc.groups) {
      if (g.paxTotal > 0) byHour.set(g.startTime, (byHour.get(g.startTime) ?? 0) + g.paxTotal);
    }
  }
  const chart: ChartBar[] = [...byHour.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([hora, pax]) => ({ hora, pax, hex: capacityHex(pax) }));

  const paxByProductKind = (test: (name: string) => boolean) =>
    boardLocations.reduce(
      (n, l) =>
        n + l.groups.filter((g) => test(g.productName)).reduce((m, g) => m + g.paxTotal, 0),
      0,
    );
  const santanyiPax = boardLocations
    .filter((l) => l.isSantanyi)
    .reduce((n, l) => n + l.paxTotal, 0);

  const countries = [
    ...new Set(active.map((b) => b.customerCountry).filter(Boolean)),
  ] as string[];

  return {
    date,
    locations: boardLocations,
    unassigned,
    pendingNoTime,
    cancelled,
    cashEntries,
    cashTotal,
    cashPending,
    chart,
    resumen: {
      paxTotal,
      kayak: paxByProductKind((n) => /kayak/i.test(n)),
      paddle: paxByProductKind((n) => /paddle/i.test(n)),
      santanyi: santanyiPax,
      countries: countries.length,
    },
    stats: {
      paxTotal,
      paxAdults,
      paxChildren,
      excursions: boardLocations.reduce(
        (n, l) => n + l.groups.filter((g) => g.paxTotal > 0).length,
        0,
      ),
      fullSlots: boardLocations.reduce(
        (n, l) => n + l.groups.filter((g) => g.paxTotal > 0 && g.free === 0).length,
        0,
      ),
      overbookedSlots: boardLocations.reduce(
        (n, l) => n + l.groups.filter((g) => g.overbookedBy > 0).length,
        0,
      ),
      splitSlots: boardLocations.reduce(
        (n, l) => n + l.groups.filter((g) => g.needsSplit).length,
        0,
      ),
      pendingReview: unassigned.length + pendingNoTime.length,
      failedEmails: failedCount.length,
      channels: [...new Set(active.map((b) => b.channel).filter(Boolean))] as string[],
      countries,
    },
  };
}

/** "Hoy" en la zona horaria de la org (YYYY-MM-DD). */
export function todayInTz(timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
