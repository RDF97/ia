"use client";

import { useActionState } from "react";
import { login } from "@/server/actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, {} as { error?: string });
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <form
        action={action}
        className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm space-y-4"
      >
        <div>
          <h1 className="text-2xl font-bold">BeachOps</h1>
          <p className="text-sm text-slate-500">Cuadro de reservas actualizado desde tu correo</p>
        </div>
        <label className="block">
          <span className="text-sm font-medium">Email</span>
          <input
            name="email"
            type="email"
            required
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Contraseña</span>
          <input
            name="password"
            type="password"
            required
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button
          disabled={pending}
          className="w-full rounded-lg bg-blue-600 text-white font-semibold py-2.5 hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
