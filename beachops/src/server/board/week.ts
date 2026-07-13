import { and, eq, gte, lte } from "drizzle-orm";
import { getDb, schema } from "../db";
import { shiftDate } from "@/lib/format";

export type WeekCell = {
  paxTotal: number;
  capacity: number;
  isDouble: boolean;
  overbooked: boolean;
};

export type WeekRow = {
  timeSlotId: string;
  startTime: string; // HH:MM
  productName: string;
  locationName: string;
  cells: (WeekCell | null)[]; // 7 días; null = sin datos ese día
};

export type Week = {
  days: string[]; // 7 fechas YYYY-MM-DD
  rows: WeekRow[];
  dayTotals: { paxTotal: number; paxAdults: number; paxChildren: number }[];
};

/** Lunes de la semana que contiene `date`. */
export function mondayOf(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  const shift = (d.getDay() + 6) % 7; // lunes=0
  return shiftDate(date, -shift);
}

export async function getWeek(orgId: string, startDate: string): Promise<Week> {
  const db = await getDb();
  const days = Array.from({ length: 7 }, (_, i) => shiftDate(startDate, i));
  const endDate = days[6];

  const [locations, products, slots, departures, bookings] = await Promise.all([
    db.select().from(schema.locations).where(eq(schema.locations.orgId, orgId)),
    db.select().from(schema.products).where(eq(schema.products.orgId, orgId)),
    db.select().from(schema.timeSlots).where(eq(schema.timeSlots.orgId, orgId)),
    db
      .select()
      .from(schema.departures)
      .where(
        and(
          eq(schema.departures.orgId, orgId),
          gte(schema.departures.date, startDate),
          lte(schema.departures.date, endDate),
        ),
      ),
    db
      .select()
      .from(schema.bookings)
      .where(
        and(
          eq(schema.bookings.orgId, orgId),
          gte(schema.bookings.activityDate, startDate),
          lte(schema.bookings.activityDate, endDate),
        ),
      ),
  ]);

  const active = bookings.filter((b) => b.status !== "cancelled");
  const paxByDeparture = new Map<string, number>();
  for (const b of active) {
    if (!b.departureId) continue;
    paxByDeparture.set(
      b.departureId,
      (paxByDeparture.get(b.departureId) ?? 0) + b.paxAdults + b.paxChildren,
    );
  }

  const rows: WeekRow[] = slots
    .filter((s) => s.active)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .map((slot) => {
      const product = products.find((p) => p.id === slot.productId);
      const location = locations.find((l) => l.id === slot.locationId);
      const cells = days.map((day) => {
        const departure = departures.find(
          (d) => d.timeSlotId === slot.id && d.date === day,
        );
        const paxTotal = departure ? paxByDeparture.get(departure.id) ?? 0 : 0;
        const capacity = departure?.capacityOverride ?? slot.defaultCapacity;
        return {
          paxTotal,
          capacity,
          isDouble: departure?.isDouble ?? false,
          overbooked: paxTotal > capacity,
        };
      });
      return {
        timeSlotId: slot.id,
        startTime: slot.startTime.slice(0, 5),
        productName: product?.name ?? "—",
        locationName: location?.name ?? "—",
        cells,
      };
    });

  const dayTotals = days.map((day) => {
    const dayBookings = active.filter((b) => b.activityDate === day);
    const paxAdults = dayBookings.reduce((n, b) => n + b.paxAdults, 0);
    const paxChildren = dayBookings.reduce((n, b) => n + b.paxChildren, 0);
    return { paxTotal: paxAdults + paxChildren, paxAdults, paxChildren };
  });

  return { days, rows, dayTotals };
}
