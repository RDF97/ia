"use client";

export function PrintButton({ className }: { className?: string }) {
  return (
    <button
      onClick={() => window.print()}
      className={className ?? "px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-sm hover:bg-slate-100"}
    >
      🖨 Imprimir
    </button>
  );
}
