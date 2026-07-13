import { eq } from "drizzle-orm";
import {
  createLocation,
  createMappingRule,
  createProduct,
  createTimeSlot,
  deleteMappingRule,
  syncNow,
  toggleLocation,
  toggleProduct,
  toggleTimeSlot,
  updateLocation,
  updateOrgCoords,
  updateProduct,
  updateTimeSlot,
} from "@/server/actions";
import { orgCoords } from "@/server/weather";
import { requireSession } from "@/server/auth";
import { getDb, schema } from "@/server/db";
import { NotificationSettings } from "./notifications";

export const dynamic = "force-dynamic";

export default async function ConfigPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const { connected, error } = await searchParams;
  const session = await requireSession();
  const db = await getDb();
  const [accounts, locations, products, slots, rules, orgRows] = await Promise.all([
    db.select().from(schema.emailAccounts).where(eq(schema.emailAccounts.orgId, session.orgId)),
    db.select().from(schema.locations).where(eq(schema.locations.orgId, session.orgId)),
    db.select().from(schema.products).where(eq(schema.products.orgId, session.orgId)),
    db.select().from(schema.timeSlots).where(eq(schema.timeSlots.orgId, session.orgId)),
    db.select().from(schema.mappingRules).where(eq(schema.mappingRules.orgId, session.orgId)),
    db.select().from(schema.orgs).where(eq(schema.orgs.id, session.orgId)),
  ]);
  const coords = orgCoords(orgRows[0]?.settings);
  const productName = (id: string) => products.find((p) => p.id === id)?.name ?? "?";
  const locationName = (id: string) => locations.find((l) => l.id === id)?.name ?? "?";
  const input = "rounded-lg border border-slate-300 px-2 py-1.5 text-sm";

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Configuración</h1>

      {connected && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-700">
          ✓ Gmail conectado. El histórico del último mes se ha importado y el cuadro se
          actualizará solo a partir de ahora.
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
          La conexión con Google falló. Inténtalo de nuevo.
        </div>
      )}

      {/* Correo */}
      <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3">
        <h2 className="font-bold">📧 Correo conectado</h2>
        {accounts.length === 0 ? (
          <p className="text-sm text-slate-500">
            Conecta el buzón donde recibes las reservas de GetYourGuide y Bókun/Viator. Solo
            pedimos permiso de <strong>lectura</strong>.
          </p>
        ) : (
          <ul className="text-sm space-y-1">
            {accounts.map((a) => (
              <li key={a.id} className="flex items-center gap-2">
                <span className={a.syncStatus === "active" ? "text-emerald-600" : "text-red-600"}>●</span>
                {a.emailAddress}
                <span className="text-xs text-slate-400">
                  {a.lastSyncedAt
                    ? `sincronizado ${new Date(a.lastSyncedAt).toLocaleTimeString("es-ES")}`
                    : "sin sincronizar"}
                </span>
                {a.syncStatus !== "active" && (
                  <span className="text-xs text-red-500">{a.lastError ?? "error"} — reconecta</span>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <a
            href="/api/gmail/connect"
            className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
          >
            {accounts.length === 0 ? "Conectar Gmail" : "Reconectar Gmail"}
          </a>
          {accounts.length > 0 && (
            <form action={syncNow}>
              <button className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-sm hover:bg-slate-100">
                ↻ Sincronizar ahora
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Notificaciones */}
      <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3">
        <h2 className="font-bold">🔔 Notificaciones en el móvil</h2>
        <NotificationSettings vapidPublicKey={process.env.VAPID_PUBLIC_KEY ?? null} />
      </section>

      {/* Playas / productos / salidas (editable) */}
      <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-4">
        <h2 className="font-bold">🏖 Playas, productos y salidas</h2>
        <p className="text-sm text-slate-500">
          La plantilla de cada día. Si un email llega con una hora que no está aquí, la reserva
          se acepta igualmente: se crea una salida &quot;extra&quot; automática en el cuadro. Lo que ya
          tiene reservas no se borra, se desactiva.
        </p>

        {locations.map((l) => (
          <div key={l.id} className={`border border-slate-200 rounded-lg p-3 space-y-2 ${!l.active ? "opacity-50" : ""}`}>
            <div className="flex items-center gap-2">
              <form action={updateLocation.bind(null, l.id)} className="flex items-center gap-1">
                <input name="name" defaultValue={l.name} className={`${input} font-semibold w-64`} />
                <button className="text-xs px-2 py-1 rounded border border-slate-300 hover:bg-slate-100">renombrar</button>
              </form>
              <form action={toggleLocation.bind(null, l.id)} className="ml-auto">
                <button className="text-xs px-2 py-1 rounded border border-slate-300 text-slate-500 hover:bg-slate-100">
                  {l.active ? "desactivar playa" : "activar playa"}
                </button>
              </form>
            </div>

            {/* Productos de la playa */}
            <div className="flex flex-wrap gap-2">
              {products
                .filter((p) => p.locationId === l.id)
                .map((p) => (
                  <span key={p.id} className={`flex items-center gap-1 text-xs border border-slate-200 rounded-full pl-2 pr-1 py-0.5 ${!p.active ? "opacity-50" : ""}`}>
                    <form action={updateProduct.bind(null, p.id)} className="flex items-center gap-1">
                      <input name="name" defaultValue={p.name} className="w-24 border-0 bg-transparent focus:outline-none" />
                      <button className="text-slate-400 hover:text-blue-600" title="Guardar nombre">✎</button>
                    </form>
                    <form action={toggleProduct.bind(null, p.id)}>
                      <button className="text-slate-300 hover:text-red-600" title={p.active ? "Desactivar" : "Activar"}>
                        {p.active ? "✕" : "↺"}
                      </button>
                    </form>
                  </span>
                ))}
              <form action={createProduct} className="flex items-center gap-1 text-xs">
                <input type="hidden" name="locationId" value={l.id} />
                <input name="name" placeholder="nuevo producto…" className={`${input} w-32`} />
                <select name="kind" className={input}>
                  <option value="tour">tour</option>
                  <option value="private">privada</option>
                </select>
                <button className="px-2 py-1 rounded bg-blue-600 text-white">añadir</button>
              </form>
            </div>

            {/* Salidas de la playa */}
            <table className="text-sm w-full">
              <tbody>
                {slots
                  .filter((s) => s.locationId === l.id)
                  .sort((a, b) => a.startTime.localeCompare(b.startTime))
                  .map((s) => (
                    <tr key={s.id} className={`border-t border-slate-100 ${!s.active ? "opacity-50" : ""}`}>
                      <td className="py-1" colSpan={2}>
                        <form action={updateTimeSlot.bind(null, s.id)} className="flex items-center gap-2">
                          <input name="startTime" defaultValue={s.startTime.slice(0, 5)} className={`${input} w-20 font-mono`} />
                          <span className="text-slate-500">{s.productId ? productName(s.productId) : "todos"}</span>
                          <span className="text-xs text-slate-400">cupo</span>
                          <input name="defaultCapacity" type="number" min={1} defaultValue={s.defaultCapacity} className={`${input} w-16`} />
                          <button className="text-xs px-2 py-1 rounded border border-slate-300 hover:bg-slate-100">guardar</button>
                        </form>
                      </td>
                      <td className="py-1 text-right">
                        <form action={toggleTimeSlot.bind(null, s.id)}>
                          <button className="text-xs px-2 py-1 rounded border border-slate-300 text-slate-500 hover:bg-slate-100">
                            {s.active ? "desactivar" : "activar"}
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                <tr className="border-t border-slate-100">
                  <td className="py-1.5" colSpan={3}>
                    <form action={createTimeSlot} className="flex items-center gap-2 text-sm">
                      <input name="startTime" placeholder="09:00" className={`${input} w-20 font-mono`} required />
                      <select name="productId" className={input} required>
                        {products
                          .filter((p) => p.locationId === l.id && p.active)
                          .map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                      </select>
                      <span className="text-xs text-slate-400">cupo</span>
                      <input name="defaultCapacity" type="number" min={1} defaultValue={12} className={`${input} w-16`} />
                      <button className="px-2 py-1 rounded bg-blue-600 text-white text-xs font-semibold">+ añadir salida</button>
                    </form>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ))}

        <form action={createLocation} className="flex items-center gap-2">
          <input name="name" placeholder="Nueva playa…" className={`${input} w-64`} required />
          <button className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">
            + Añadir playa
          </button>
        </form>
      </section>

      {/* Meteo */}
      <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-2">
        <h2 className="font-bold">🌤 Meteo del cuadro</h2>
        <p className="text-sm text-slate-500">
          Con las coordenadas de la playa, el cuadro muestra viento, rachas, olas y temperatura a
          las horas de cada salida (datos de Open-Meteo). Mondragó: 39.349, 3.189.
        </p>
        <form action={updateOrgCoords} className="flex flex-wrap gap-2 items-end">
          <label className="text-xs">
            Latitud
            <input name="lat" defaultValue={coords?.lat ?? ""} placeholder="39.349" required className={`${input} block w-28`} />
          </label>
          <label className="text-xs">
            Longitud
            <input name="lng" defaultValue={coords?.lng ?? ""} placeholder="3.189" required className={`${input} block w-28`} />
          </label>
          <button className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">
            Guardar
          </button>
          {coords && <span className="text-xs text-emerald-600">✓ configurado</span>}
        </form>
      </section>

      {/* Reglas de mapeo */}
      <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3">
        <h2 className="font-bold">🔀 Reglas de mapeo</h2>
        <p className="text-sm text-slate-500">
          Cuando llega un email, el nombre del producto se compara con estas reglas (por orden de
          prioridad) para decidir producto y playa. La salida se elige por la hora del email.
        </p>
        <table className="w-full text-sm">
          <thead className="text-xs text-slate-400 text-left">
            <tr>
              <th className="py-1">Prio</th>
              <th className="py-1">Si el producto contiene…</th>
              <th className="py-1">→ Producto</th>
              <th className="py-1">→ Playa</th>
              <th className="py-1" />
            </tr>
          </thead>
          <tbody>
            {rules
              .filter((r) => r.active)
              .sort((a, b) => a.priority - b.priority)
              .map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="py-1.5">{r.priority}</td>
                  <td className="py-1.5 font-mono text-xs">{r.matchValue}</td>
                  <td className="py-1.5">{productName(r.targetProductId)}</td>
                  <td className="py-1.5">{locationName(r.targetLocationId)}</td>
                  <td className="py-1.5 text-right">
                    <form action={deleteMappingRule.bind(null, r.id)}>
                      <button className="text-slate-300 hover:text-red-600" title="Desactivar regla">✕</button>
                    </form>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        <form action={createMappingRule} className="flex flex-wrap gap-2 items-end border-t border-slate-100 pt-3">
          <label className="text-xs">
            Prioridad
            <input name="priority" type="number" defaultValue={50} className={`${input} block w-20`} />
          </label>
          <label className="text-xs flex-1 min-w-40">
            Texto a buscar
            <input name="matchValue" required placeholder="p. ej. Paddle Surf" className={`${input} block w-full`} />
          </label>
          <label className="text-xs">
            Producto
            <select name="targetProductId" className={`${input} block`}>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            Playa
            <select name="targetLocationId" className={`${input} block`}>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </label>
          <input type="hidden" name="matchType" value="contains" />
          <button className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">
            Añadir regla
          </button>
        </form>
      </section>
    </div>
  );
}
