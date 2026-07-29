/** Bandera emoji a partir del código ISO-2 (ES → 🇪🇸). */
export function flagEmoji(iso2: string | null | undefined): string {
  if (!iso2 || iso2.length !== 2) return "";
  return String.fromCodePoint(
    ...iso2.toUpperCase().split("").map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}

export function formatEuro(amount: number | string | null | undefined): string {
  if (amount == null || amount === "") return "—";
  return `${Number(amount).toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`;
}

/** "2026-07-10" → "Viernes, 10 de julio de 2026" (solo la inicial en mayúscula) */
export function formatDateEs(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  const s = d.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Versión corta para el móvil: "vie 10 jul" */
export function formatDateShortEs(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  const s = d.toLocaleDateString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/\.$/, "");
}

export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
