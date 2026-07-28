import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ignoreEmail, reprocessEmail } from "@/server/actions";
import { requireSession } from "@/server/auth";
import { getDb, schema } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function EmailDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const db = await getDb();
  const [raw] = await db
    .select()
    .from(schema.rawEmails)
    .where(and(eq(schema.rawEmails.id, id), eq(schema.rawEmails.orgId, session.orgId)));
  if (!raw) notFound();

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3 flex-wrap">
        <Link href="/emails" className="text-sm text-blue-600">← Emails</Link>
        <h1 className="text-lg font-bold truncate">{raw.subject ?? "(sin asunto)"}</h1>
        <span className="ml-auto flex gap-2 no-print">
          <form action={reprocessEmail.bind(null, raw.id)}>
            <button className="text-xs px-2 py-1 rounded border border-slate-300 hover:bg-slate-100">↻ reintentar parseo</button>
          </form>
          {raw.parseStatus === "failed" && (
            <form action={ignoreEmail.bind(null, raw.id)}>
              <button className="text-xs px-2 py-1 rounded border border-slate-300 text-slate-400 hover:bg-slate-100">ignorar</button>
            </form>
          )}
        </span>
      </header>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 text-sm space-y-1">
        <p><span className="text-slate-400">De:</span> {raw.fromAddress}</p>
        <p><span className="text-slate-400">Recibido:</span> {raw.receivedAt ? new Date(raw.receivedAt).toLocaleString("es-ES") : "—"}</p>
        <p>
          <span className="text-slate-400">Estado:</span> {raw.parseStatus}
          {raw.detectedSource && ` · ${raw.detectedSource}`}
          {raw.detectedKind && ` · ${raw.detectedKind}`}
        </p>
        {raw.parseError && <p className="text-red-600">Error: {raw.parseError}</p>}
        {raw.parsedPayload != null && (
          <details className="text-xs">
            <summary className="cursor-pointer text-slate-400">Datos extraídos</summary>
            <pre className="bg-slate-50 rounded p-2 overflow-x-auto">{JSON.stringify(raw.parsedPayload, null, 2)}</pre>
          </details>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <p className="px-3 py-2 text-xs text-slate-400 border-b border-slate-100">Contenido del email</p>
        {raw.bodyHtml ? (
          <iframe
            sandbox=""
            srcDoc={raw.bodyHtml}
            className="w-full h-[70vh] bg-white"
            title="Email"
          />
        ) : raw.bodyText ? (
          <pre className="p-3 text-sm whitespace-pre-wrap">{raw.bodyText}</pre>
        ) : (
          <p className="p-3 text-sm text-slate-400">El email no tiene contenido guardado.</p>
        )}
      </div>
    </div>
  );
}
