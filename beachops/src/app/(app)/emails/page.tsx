import { desc, eq } from "drizzle-orm";
import { ignoreEmail, reprocessEmail, syncNow } from "@/server/actions";
import { requireSession } from "@/server/auth";
import { getDb, schema } from "@/server/db";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { text: string; cls: string }> = {
  parsed: { text: "procesado", cls: "bg-emerald-100 text-emerald-700" },
  failed: { text: "fallido", cls: "bg-red-100 text-red-600" },
  ignored: { text: "ignorado", cls: "bg-slate-100 text-slate-500" },
  pending: { text: "pendiente", cls: "bg-amber-100 text-amber-700" },
  manual_resolved: { text: "resuelto a mano", cls: "bg-blue-100 text-blue-700" },
};

export default async function EmailsPage() {
  const session = await requireSession();
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.rawEmails)
    .where(eq(schema.rawEmails.orgId, session.orgId))
    .orderBy(desc(schema.rawEmails.receivedAt))
    .limit(100);
  const failed = rows.filter((r) => r.parseStatus === "failed");

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <h1 className="text-xl font-bold">Emails de reservas</h1>
        <form action={syncNow} className="ml-auto">
          <button className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-sm hover:bg-slate-100">
            ↻ Sincronizar ahora
          </button>
        </form>
      </header>

      {failed.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
          ⚠ {failed.length} email{failed.length > 1 ? "s" : ""} no se pudieron procesar. Revísalos
          abajo: puedes reintentar (tras ajustar reglas) o crear la reserva a mano.
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-slate-400 text-left">
            <tr>
              <th className="px-3 py-2">Recibido</th>
              <th className="px-2 py-2">De</th>
              <th className="px-2 py-2">Asunto</th>
              <th className="px-2 py-2">Estado</th>
              <th className="px-2 py-2">Error</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const s = STATUS[r.parseStatus] ?? STATUS.pending;
              return (
                <tr key={r.id} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-1.5 whitespace-nowrap text-xs text-slate-500">
                    {r.receivedAt ? new Date(r.receivedAt).toLocaleString("es-ES") : "—"}
                  </td>
                  <td className="px-2 py-1.5 text-xs max-w-40 truncate">{r.fromAddress}</td>
                  <td className="px-2 py-1.5 max-w-72 truncate">{r.subject}</td>
                  <td className="px-2 py-1.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${s.cls}`}>{s.text}</span>
                  </td>
                  <td className="px-2 py-1.5 text-xs text-red-500 max-w-52">{r.parseError}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    {r.parseStatus === "failed" && (
                      <span className="flex gap-1">
                        <form action={reprocessEmail.bind(null, r.id)}>
                          <button className="text-xs px-2 py-0.5 rounded border border-slate-300 hover:bg-slate-100">reintentar</button>
                        </form>
                        <form action={ignoreEmail.bind(null, r.id)}>
                          <button className="text-xs px-2 py-0.5 rounded border border-slate-300 text-slate-400 hover:bg-slate-100">ignorar</button>
                        </form>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">Sin emails todavía. Conecta tu Gmail en Configuración.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
