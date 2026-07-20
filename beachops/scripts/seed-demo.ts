/**
 * Día de demostración: reconstruye el cuadro real del 10 de julio de 2026
 * (65 pax, 10:00 sobre-reservado 14/12, dobles salidas a las 15:00 y 17:30,
 * caja con hotel 70 € y privada por confirmar).
 *   npm run db:seed:demo
 */
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "../src/server/db";
import { ensureDeparture } from "../src/server/ingest/process";
import { seed } from "./seed";

const DATE = "2026-07-10";

type Row = [pax: number, name: string, phone: string, ref: string, children?: number];

const KAYAK_1000: Row[] = [
  [2, "Idoia Alegre Jaso", "+34620788391", "GYGMX4GMB5BY"],
  [2, "John Rutter", "+447497882152", "GYGLMRXRFRN5"],
  [5, "Galiana Thierry", "+33684192556", "GYG996Z93ZKF"],
  [2, "Francesca Lillie", "+447526271467", "GYGWZAVH62MX"],
  [3, "Gonçalo Gonçalves", "+351969030026", "GYG141EUR"],
];
const PADDLE_1000: Row[] = [[2, "Annabell Holtmann", "+4915201499934", "GYGRFQL6LZ67"]];
const KAYAK_1230: Row[] = [
  [2, "Civan Akpinar", "+491726192556", "GYGBLHKX5FZ3"],
  [2, "Eva Kanai", "+436769541322", "GYG2Q9HMWMM5"],
  [4, "Karen Wratten", "+447702727005", "GYGLMRXHK9N6"],
  [1, "Kay Kiefer", "+4917672336402", "GYGBLHKXF7RF"],
];
const PADDLE_1230: Row[] = [
  [2, "Hamza Belkhadir", "+33745758830", "GYGX7NAWG7YR"],
  [2, "Yi Tang", "+34661466695", "GYGKBGBW23ZH"],
];
const KAYAK_1500: Row[] = [
  [2, "Carole Le Gall", "+33669328614", "GYGRFQL6R74X"],
  [2, "Emma Nyengaard", "+4530514237", "GYG2Q9HWG7MB"],
  [2, "Katharina Mehner", "+491725461833", "GYGG45QNFYNW"],
  [2, "Zaida Nor Dergane Diaz", "+31658861106", "GYGG45QNGN3X"],
  [2, "Tobias Bønnelykke", "+4553782333", "GYGVN2627YB4"],
  [2, "Romina Alladio", "+393661107224", "GYGFWV5RXVHK"],
  [2, "Kaya Zom", "+31657048440", "GYGBLHKW8RM9"],
];
const KAYAK_1730: Row[] = [
  [5, "Anni Vinken", "+4916096995817", "GYGN6B2979FN"],
  [2, "Leo", "+447536401315", "GYG48YNBQW56"],
  [2, "Dylan Byrne", "+353864120749", "GYG6H7787X3Q"],
  [2, "Luca Kertész", "+36309212339", "GYGWZARYV546"],
];

async function main() {
  const orgId = (await seed()) as string;
  const db = await getDb();

  const slots = await db
    .select()
    .from(schema.timeSlots)
    .where(eq(schema.timeSlots.orgId, orgId));
  const products = await db
    .select()
    .from(schema.products)
    .where(eq(schema.products.orgId, orgId));
  const productByName = new Map(products.map((p) => [p.name, p]));
  const slotFor = (time: string, product: string) => {
    const p = productByName.get(product);
    const s = slots.find((s) => s.startTime.startsWith(time) && s.productId === p?.id);
    if (!s) throw new Error(`No hay franja ${time} ${product}`);
    return s;
  };

  async function addGyg(time: string, product: string, rows: Row[]) {
    const slot = slotFor(time, product);
    const departureId = await ensureDeparture(orgId, slot.id, DATE);
    for (const [pax, name, phone, ref, children] of rows) {
      await db
        .insert(schema.bookings)
        .values({
          orgId,
          departureId,
          source: "getyourguide",
          channel: "GetYourGuide",
          externalRef: ref,
          status: "confirmed",
          activityDate: DATE,
          activityTime: slot.startTime,
          productId: slot.productId,
          locationId: slot.locationId,
          rawProductName: `Mallorca: ${product} Excursion`,
          paxAdults: pax - (children ?? 0),
          paxChildren: children ?? 0,
          customerName: name,
          customerPhone: phone,
          customerCountry: countryOf(phone),
          paymentKind: "platform",
        })
        .onConflictDoNothing();
    }
    return departureId;
  }

  await addGyg("10:00", "Kayak", KAYAK_1000);
  await addGyg("10:00", "Paddle Surf", PADDLE_1000);
  await addGyg("12:30", "Kayak", KAYAK_1230);
  await addGyg("12:30", "Paddle Surf", PADDLE_1230);

  // 15:00 y 17:30: dobles salidas (cupo ampliado)
  const dep1500 = await addGyg("15:00", "Kayak", KAYAK_1500);
  await db
    .update(schema.departures)
    .set({ isDouble: true, capacityOverride: 20 })
    .where(eq(schema.departures.id, dep1500));

  const dep1730 = await addGyg("17:30", "Kayak", KAYAK_1730);
  await db
    .update(schema.departures)
    .set({ isDouble: true, capacityOverride: 20 })
    .where(eq(schema.departures.id, dep1730));

  // Hotel 17:30 — Alexandra (1 ad + 1 niño), 70 € efectivo
  const slot1730 = slotFor("17:30", "Kayak");
  const [alexandra] = await db
    .insert(schema.bookings)
    .values({
      orgId,
      departureId: dep1730,
      source: "manual",
      channel: "Hotel",
      externalRef: "HOTEL-ALEXANDRA-0710",
      status: "confirmed",
      activityDate: DATE,
      activityTime: slot1730.startTime,
      productId: slot1730.productId,
      locationId: slot1730.locationId,
      paxAdults: 1,
      paxChildren: 1,
      customerName: "Alexandra",
      customerPhone: "+32470550904",
      customerCountry: "BE",
      paymentKind: "cash",
      cashAmount: "70.00",
      cashConfirmed: true,
      notes: "1×45€ + 1×25€",
    })
    .onConflictDoNothing()
    .returning();
  if (alexandra) {
    await db.insert(schema.cashEntries).values({
      orgId,
      date: DATE,
      bookingId: alexandra.id,
      concept: "Hotel 17:30 — Alexandra (1 ad + 1 niño)",
      amount: "70.00",
      confirmed: true,
    });
  }

  // Privada 18:00 — María del Mar (4 ad + 4 niños), importe por confirmar
  const slot1800 = slotFor("18:00", "Privada");
  const dep1800 = await ensureDeparture(orgId, slot1800.id, DATE);
  const [privada] = await db
    .insert(schema.bookings)
    .values({
      orgId,
      departureId: dep1800,
      source: "manual",
      channel: "Privada",
      externalRef: "PRIVADA-MARIADELMAR-0710",
      status: "confirmed",
      activityDate: DATE,
      activityTime: slot1800.startTime,
      productId: slot1800.productId,
      locationId: slot1800.locationId,
      paxAdults: 4,
      paxChildren: 4,
      customerName: "María del Mar",
      customerPhone: "+34608263383",
      customerCountry: "ES",
      paymentKind: "pending",
      notes: "Excursión privada · confirmar importe",
    })
    .onConflictDoNothing()
    .returning();
  if (privada) {
    await db.insert(schema.cashEntries).values({
      orgId,
      date: DATE,
      bookingId: privada.id,
      concept: "Privada 18:00 — María del Mar (4 ad + 4 niños)",
      amount: null,
      confirmed: false,
    });
  }

  // WhatsApp 12:30 Kayak — 2 ad efectivo (40/20 → 80 €)
  const slot1230 = slotFor("12:30", "Kayak");
  const dep1230 = await ensureDeparture(orgId, slot1230.id, DATE);
  const [wa] = await db
    .insert(schema.bookings)
    .values({
      orgId,
      departureId: dep1230,
      source: "manual",
      channel: "WhatsApp",
      externalRef: "WA-0710-1",
      status: "confirmed",
      activityDate: DATE,
      activityTime: slot1230.startTime,
      productId: slot1230.productId,
      locationId: slot1230.locationId,
      paxAdults: 2,
      customerName: "Marco (WhatsApp)",
      customerPhone: "+393401234567",
      customerCountry: "IT",
      paymentKind: "cash",
      cashAmount: "80.00",
      cashConfirmed: true,
    })
    .onConflictDoNothing()
    .returning();
  if (wa) {
    await db.insert(schema.cashEntries).values({
      orgId,
      date: DATE,
      bookingId: wa.id,
      concept: "WhatsApp 12:30 — Marco (2 ad)",
      amount: "80.00",
      confirmed: true,
    });
  }

  // Cala Santanyí (Es Pontàs) 10:30 — 6 pax, monitor aparte, directa efectivo
  const slotPontas = slotFor("10:30", "Es Pontàs");
  const depPontas = await ensureDeparture(orgId, slotPontas.id, DATE);
  const [pontas] = await db
    .insert(schema.bookings)
    .values({
      orgId,
      departureId: depPontas,
      source: "manual",
      channel: "Instagram",
      externalRef: "IG-PONTAS-0710",
      status: "confirmed",
      activityDate: DATE,
      activityTime: slotPontas.startTime,
      productId: slotPontas.productId,
      locationId: slotPontas.locationId,
      paxAdults: 6,
      customerName: "Grupo Es Pontàs",
      customerPhone: "+34600111222",
      customerCountry: "ES",
      paymentKind: "cash",
      cashAmount: "240.00",
      cashConfirmed: true,
    })
    .onConflictDoNothing()
    .returning();
  if (pontas) {
    await db.insert(schema.cashEntries).values({
      orgId,
      date: DATE,
      bookingId: pontas.id,
      concept: "Instagram 10:30 Es Pontàs — Grupo (6 ad)",
      amount: "240.00",
      confirmed: true,
    });
  }

  const total = await db
    .select()
    .from(schema.bookings)
    .where(and(eq(schema.bookings.orgId, orgId), eq(schema.bookings.activityDate, DATE)));
  const pax = total.reduce((n, b) => n + b.paxAdults + b.paxChildren, 0);
  console.log(`Demo del ${DATE} creada: ${total.length} reservas, ${pax} pax.`);
  process.exit(0);
}

function countryOf(phone: string): string | null {
  const prefixes: [string, string][] = [
    ["+34", "ES"], ["+44", "GB"], ["+33", "FR"], ["+351", "PT"], ["+49", "DE"],
    ["+43", "AT"], ["+45", "DK"], ["+31", "NL"], ["+39", "IT"], ["+353", "IE"],
    ["+36", "HU"], ["+32", "BE"],
  ];
  const hit = prefixes
    .filter(([p]) => phone.startsWith(p))
    .sort((a, b) => b[0].length - a[0].length)[0];
  return hit?.[1] ?? null;
}

main();
