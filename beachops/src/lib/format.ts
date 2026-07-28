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

/** "2026-07-10" → "viernes 10 julio 2026" */
export function formatDateEs(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  return d.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
