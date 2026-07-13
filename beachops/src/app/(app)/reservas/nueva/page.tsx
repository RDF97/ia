import { eq } from "drizzle-orm";
import { createManualBooking } from "@/server/actions";
import { requireSession } from "@/server/auth";
import { getDb, schema } from "@/server/db";
import { todayInTz } from "@/server/board/query";

export const dynamic = "force-dynamic";

export default async function NuevaReservaPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const session = await requireSession();
  const db = await getDb();
  const [slots, products, locations] = await Promise.all([
    db.select().from(schema.timeSlots).where(eq(schema.timeSlots.orgId, session.orgId)),
    db.select().from(schema.products).where(eq(schema.products.orgId, session.orgId)),
    db.select().from(schema.locations).where(eq(schema.locations.orgId, session.orgId)),
  ]);
  const label = (s: (typeof slots)[number]) => {
    const product = products.find((p) => p.id === s.productId)?.name ?? "";
    const loc = locations.find((l) => l.id === s.locationId)?.name ?? "";
    return `${s.startTime.slice(0, 5)} · ${product} · ${loc}`;
  };

  const input = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";
  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-bold mb-4">Nueva reserva manual</h1>
      <form action={createManualBooking} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium">
            Fecha
            <input type="date" name="date" required defaultValue={date ?? todayInTz("Europe/Madrid")} className={input} />
          </label>
          <label className="block text-sm font-medium">
            Salida
            <select name="timeSlotId" required className={input}>
              {slots
                .sort((a, b) => a.startTime.localeCompare(b.startTime))
                .map((s) => (
                  <option key={s.id} value={s.id}>{label(s)}</option>
                ))}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium">
            Adultos
            <input type="number" name="paxAdults" min={0} defaultValue={2} required className={input} />
          </label>
          <label className="block text-sm font-medium">
            Niños
            <input type="number" name="paxChildren" min={0} defaultValue={0} className={input} />
          </label>
        </div>
        <label className="block text-sm font-medium">
          Nombre del cliente
          <input name="customerName" required className={input} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium">
            Teléfono
            <input name="customerPhone" placeholder="+34 …" className={input} />
          </label>
          <label className="block text-sm font-medium">
            Canal
            <select name="channel" className={input}>
              <option>Directa</option>
              <option>Hotel</option>
              <option>Privada</option>
            </select>
          </label>
        </div>
        <label className="block text-sm font-medium">
          Hotel de recogida (opcional)
          <input name="pickupHotel" className={input} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium">
            Pago
            <select name="paymentKind" className={input}>
              <option value="cash">Efectivo</option>
              <option value="pending">Por confirmar</option>
              <option value="platform">Ya cobrado</option>
            </select>
          </label>
          <label className="block text-sm font-medium">
            Importe €
            <input name="cashAmount" placeholder="70" className={input} />
          </label>
        </div>
        <label className="block text-sm font-medium">
          Notas
          <textarea name="notes" rows={2} className={input} />
        </label>
        <button className="w-full rounded-lg bg-blue-600 text-white font-semibold py-2.5 hover:bg-blue-700">
          Crear reserva
        </button>
      </form>
    </div>
  );
}
