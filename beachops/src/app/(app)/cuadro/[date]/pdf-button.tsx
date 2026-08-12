"use client";

import { useState } from "react";
import { Spinner } from "@/components/submit-button";

/**
 * Descarga del PDF del cuadro. La generación tarda unos segundos (se renderiza
 * la página con Chromium), así que el botón avisa mientras trabaja y confirma
 * al terminar en vez de quedarse mudo.
 */
export function PdfButton({ date, className }: { date: string; className?: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setState("loading");
    setError(null);
    try {
      const res = await fetch(`/cuadro/${date}/pdf`);
      if (!res.ok) {
        // El servidor explica el motivo (p. ej. falta Chromium): se enseña.
        throw new Error((await res.text()) || `Error ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileNameFor(date);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setState("done");
      setTimeout(() => setState("idle"), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState("error");
    }
  }

  const label =
    state === "loading"
      ? "Generando PDF…"
      : state === "done"
        ? "✓ Descargado"
        : state === "error"
          ? "✕ Reintentar"
          : "⬇ PDF";

  return (
    <span className="relative inline-flex flex-col items-end">
      <button
        onClick={download}
        disabled={state === "loading"}
        aria-busy={state === "loading"}
        className={
          className ??
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-white text-sm font-semibold hover:bg-slate-900 disabled:opacity-70 disabled:cursor-wait"
        }
      >
        {state === "loading" && <Spinner />}
        {label}
      </button>
      {state === "error" && error && (
        <span className="absolute top-full right-0 mt-1 z-20 w-72 rounded-lg border border-red-300 bg-red-50 p-2 text-xs text-red-700 shadow">
          {error}
        </span>
      )}
    </span>
  );
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function fileNameFor(date: string): string {
  const [y, m, d] = date.split("-");
  return `cuadro_${Number(d)}${MESES[Number(m) - 1] ?? m}_${y}.pdf`;
}
