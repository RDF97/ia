import { eq } from "drizzle-orm";
import { createMappingRule, deleteMappingRule, syncNow } from "@/server/actions";
import { requireSession } from "@/server/auth";
import { getDb, schema } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function ConfigPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const { connected, error } = await searchParams;
  const session = await requireSession();
  const db = await getDb();
  const [accounts, locations, products, slots, rules] = await Promise.all([
    db.select().from(schema.emailAccounts).where(eq(schema.emailAccounts.orgId, session.orgId)),
    db.select().from(schema.locations).where(eq(schema.locations.orgId, session.orgId)),
    db.select().from(schema.products).where(eq(schema.products.orgId, session.orgId)),
    db.select().from(schema.timeSlots).where(eq(schema.timeSlots.orgId, session.orgId)),
    db.select().from(schema.mappingRules).where(eq(schema.mappingRules.orgId, session.orgId)),
  ]);
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

      {/* Playas / productos / franjas */}
      <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-2">
        <h2 className="font-bold">🏖 Playas, productos y salidas</h2>
        {locations.map((l) => (
          <div key={l.id} className="text-sm">
            <p className="font-semibold">{l.name}</p>
            <ul className="ml-4 text-slate-600">
              {slots
                .filter((s) => s.locationId === l.id)
                .sort((a, b) => a.startTime.localeCompare(b.startTime))
                .map((s) => (
                  <li key={s.id}>
                    {s.startTime.slice(0, 5)} — {s.productId ? productName(s.productId) : "todos"} · cupo {s.defaultCapacity}
                  </li>
                ))}
            </ul>
          </div>
        ))}
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
