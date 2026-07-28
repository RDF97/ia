"use client";

import { useActionState } from "react";
import { connectImapAccount } from "@/server/actions";

const input = "mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm";

export function ImapForm({ defaultEmail }: { defaultEmail?: string }) {
  const [state, action, pending] = useActionState(connectImapAccount, {} as {
    error?: string;
    ok?: boolean;
  });
  return (
    <form action={action} className="border-t border-slate-100 pt-3 space-y-2">
      <p className="text-sm font-semibold">
        ¿Tu correo no es Gmail? Conéctalo por IMAP
        <span className="font-normal text-slate-500"> (Dynu, IONOS, etc.)</span>
      </p>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs">
          Email
          <input name="email" type="email" required defaultValue={defaultEmail} className={input} />
        </label>
        <label className="text-xs">
          Contraseña del buzón
          <input name="password" type="password" required className={input} />
        </label>
        <label className="text-xs">
          Servidor IMAP
          <input name="host" required placeholder="imap.dynu.com" className={input} />
        </label>
        <label className="text-xs">
          Puerto
          <input name="port" type="number" defaultValue={993} className={input} />
        </label>
      </div>
      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
      {state.ok && (
        <p className="text-xs text-emerald-600">
          ✓ Conectado. Importando el último mes de correo — mira la pestaña Emails.
        </p>
      )}
      <button
        disabled={pending}
        className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? "Comprobando conexión…" : "Conectar IMAP"}
      </button>
      <p className="text-xs text-slate-400">
        La contraseña se guarda cifrada y solo se usa para leer el buzón. En Dynu, el servidor
        entrante es normalmente <code>imap.dynu.com</code> con puerto 993 (SSL) — compruébalo en
        tu panel de Dynu si falla.
      </p>
    </form>
  );
}
