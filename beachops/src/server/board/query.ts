import { and, eq } from "drizzle-orm";
import { getDb, schema } from "../db";
import { Booking, CashEntry } from "../db/schema";

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
};

export type BoardLocation = {
  locationId: string;
  name: string;
  groups: BoardSlotGroup[];
  paxTotal: number;
};

export type Board = {
  date: string;
  locations: BoardLocation[];
  unassigned: Booking[];
  cancelled: Booking[];
  cashEntries: (CashEntry & { customerName: string | null })[];
  cashTotal: number;
  cashPending: number;
  stats: {
    paxTotal: number;
    paxAdults: number;
    paxChildren: number;
    excursions: number;
    overbookedSlots: number;
    pendingReview: number;
    failedEmails: number;
    channels: string[];
    countries: string[];
  };
};

function hhmm(t: string): string {
  return t.slice(0, 5);
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

  const boardLocations: BoardLocation[] = locations
    .filter((l) => l.active)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((loc) => {
      const groups: BoardSlotGroup[] = slots
        .filter((s) => s.active && s.locationId === loc.id)
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
        .map((slot) => {
          const departure = departures.find((d) => d.timeSlotId === slot.id) ?? null;
          const slotBookings = active.filter(
            (b) => b.departureId && departure && b.departureId === departure.id,
          );
          const paxAdults = slotBookings.reduce((n, b) => n + b.paxAdults, 0);
          const paxChildren = slotBookings.reduce((n, b) => n + b.paxChildren, 0);
          const paxTotal = paxAdults + paxChildren;
          const capacity = departure?.capacityOverride ?? slot.defaultCapacity;
          const product = slot.productId ? productById.get(slot.productId) : undefined;
          return {
            timeSlotId: slot.id,
            departureId: departure?.id ?? null,
            isAdHoc: false,
            startTime: hhmm(slot.startTime),
            productId: slot.productId,
            productName: product?.name ?? "—",
            productKind: product?.kind ?? "tour",
            capacity,
            isDouble: departure?.isDouble ?? false,
            bookings: slotBookings.sort((a, b) =>
              (a.customerName ?? "").localeCompare(b.customerName ?? ""),
            ),
            paxAdults,
            paxChildren,
            paxTotal,
            free: Math.max(0, capacity - paxTotal),
            overbookedBy: Math.max(0, paxTotal - capacity),
          };
        });
      // Salidas "extra" (ad-hoc) de esta playa: creadas automáticamente al
      // llegar reservas con horas fuera de la plantilla.
      const adHocGroups: BoardSlotGroup[] = departures
        .filter((d) => !d.timeSlotId && d.locationId === loc.id)
        .map((d) => {
          const slotBookings = active.filter((b) => b.departureId === d.id);
          const paxAdults = slotBookings.reduce((n, b) => n + b.paxAdults, 0);
          const paxChildren = slotBookings.reduce((n, b) => n + b.paxChildren, 0);
          const paxTotal = paxAdults + paxChildren;
          const capacity = d.capacityOverride ?? 12;
          const product = d.productId ? productById.get(d.productId) : undefined;
          return {
            timeSlotId: null,
            departureId: d.id,
            isAdHoc: true,
            startTime: hhmm(d.startTime),
            productId: d.productId,
            productName: product?.name ?? "—",
            productKind: product?.kind ?? "tour",
            capacity,
            isDouble: d.isDouble,
            bookings: slotBookings,
            paxAdults,
            paxChildren,
            paxTotal,
            free: Math.max(0, capacity - paxTotal),
            overbookedBy: Math.max(0, paxTotal - capacity),
          };
        });

      const allGroups = [...groups, ...adHocGroups].sort((a, b) =>
        a.startTime.localeCompare(b.startTime),
      );
      return {
        locationId: loc.id,
        name: loc.name,
        groups: allGroups,
        paxTotal: allGroups.reduce((n, g) => n + g.paxTotal, 0),
      };
    });

  const assignedIds = new Set(
    boardLocations.flatMap((l) => l.groups.flatMap((g) => g.bookings.map((b) => b.id))),
  );
  const unassigned = active.filter((b) => !assignedIds.has(b.id));

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

  return {
    date,
    locations: boardLocations,
    unassigned,
    cancelled,
    cashEntries,
    cashTotal,
    cashPending,
    stats: {
      paxTotal: paxAdults + paxChildren,
      paxAdults,
      paxChildren,
      excursions: boardLocations.reduce(
        (n, l) => n + l.groups.filter((g) => g.paxTotal > 0).length,
        0,
      ),
      overbookedSlots: boardLocations.reduce(
        (n, l) => n + l.groups.filter((g) => g.overbookedBy > 0).length,
        0,
      ),
      pendingReview: unassigned.length,
      failedEmails: failedCount.length,
      channels: [...new Set(active.map((b) => b.channel).filter(Boolean))] as string[],
      countries: [...new Set(active.map((b) => b.customerCountry).filter(Boolean))] as string[],
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
