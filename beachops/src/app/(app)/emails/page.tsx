import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import {
  ignoreAllFailed,
  ignoreEmail,
  reprocessAllBookings,
  reprocessEmail,
  retryAllFailed,
  syncNow,
} from "@/server/actions";
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
  // Los 100 más recientes para la vista general…
  const rows = await db
    .select()
    .from(schema.rawEmails)
    .where(eq(schema.rawEmails.orgId, session.orgId))
    .orderBy(desc(schema.rawEmails.receivedAt))
    .limit(100);
  // …y TODOS los fallidos (aunque sean antiguos y no entren en los 100), para que
  // coincida con el aviso del cuadro y se puedan limpiar.
  const failed = await db
    .select()
    .from(schema.rawEmails)
    .where(
      and(
        eq(schema.rawEmails.orgId, session.orgId),
        eq(schema.rawEmails.parseStatus, "failed"),
      ),
    )
    .orderBy(desc(schema.rawEmails.receivedAt));

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-bold">Emails de reservas</h1>
        <div className="ml-auto flex gap-2">
          <form action={reprocessAllBookings}>
            <button className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700" title="Vuelve a aplicar el mapeo a todas las reservas (mueve Es Pontàs a Cala Santanyí, etc.)">
              ↻ Reprocesar reservas
            </button>
          </form>
          <form action={syncNow}>
            <button className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-sm hover:bg-slate-100">
              ↻ Sincronizar ahora
            </button>
          </form>
        </div>
      </header>

      {failed.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-3 flex-wrap text-sm text-red-700">
            <span className="font-semibold">
              ⚠ {failed.length} email{failed.length > 1 ? "s" : ""} no se pudieron leer
            </span>
            <div className="ml-auto flex gap-2">
              <form action={retryAllFailed}>
                <button className="px-3 py-1 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700">
                  ↻ Reintentar todos
                </button>
              </form>
              <form action={ignoreAllFailed}>
                <button className="px-3 py-1 rounded-lg bg-white border border-red-300 text-red-600 text-xs font-semibold hover:bg-red-100">
                  Ignorar todos
                </button>
              </form>
            </div>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {failed.map((r) => (
                <tr key={r.id} className="border-t border-red-100 align-top">
                  <td className="py-1.5 pr-2 whitespace-nowrap text-xs text-slate-500">
                    {r.receivedAt ? new Date(r.receivedAt).toLocaleDateString("es-ES") : "—"}
                  </td>
                  <td className="py-1.5 pr-2 max-w-72 truncate">
                    <Link href={`/emails/${r.id}`} className="hover:underline">
                      {r.subject ?? "(sin asunto)"}
                    </Link>
                  </td>
                  <td className="py-1.5 pr-2 text-xs text-red-500 max-w-52 truncate">{r.parseError}</td>
                  <td className="py-1.5 whitespace-nowrap text-right">
                    <span className="flex gap-1 justify-end">
                      <form action={reprocessEmail.bind(null, r.id)}>
                        <button className="text-xs px-2 py-0.5 rounded border border-slate-300 hover:bg-white">reintentar</button>
                      </form>
                      <form action={ignoreEmail.bind(null, r.id)}>
                        <button className="text-xs px-2 py-0.5 rounded border border-slate-300 text-slate-400 hover:bg-white">ignorar</button>
                      </form>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
              const s =
                r.detectedKind === "message"
                  ? { text: "💬 mensaje", cls: "bg-sky-100 text-sky-700" }
                  : STATUS[r.parseStatus] ?? STATUS.pending;
              return (
                <tr key={r.id} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-1.5 whitespace-nowrap text-xs text-slate-500">
                    {r.receivedAt ? new Date(r.receivedAt).toLocaleString("es-ES") : "—"}
                  </td>
                  <td className="px-2 py-1.5 text-xs max-w-40 truncate">{r.fromAddress}</td>
                  <td className="px-2 py-1.5 max-w-72 truncate">
                    <Link href={`/emails/${r.id}`} className="hover:text-blue-700 hover:underline">
                      {r.subject ?? "(sin asunto)"}
                    </Link>
                  </td>
                  <td className="px-2 py-1.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${s.cls}`}>{s.text}</span>
                  </td>
                  <td className="px-2 py-1.5 text-xs text-red-500 max-w-52">
                    {r.parseStatus === "failed" ? r.parseError : null}
                  </td>
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
