/**
 * Reglas de negocio del cuadro diario de Secret Point Mallorca (instructivo
 * operativo). Constantes y helpers puros, sin dependencias de DB, para poder
 * reutilizarlos en la agregación (query.ts), la página del cuadro y el
 * generador de PDF, y testearlos aislados.
 */

// ── Colores fijos del estándar visual ──────────────────────────────────

export const BOARD_BG = "#F5F4F0";
export const CHILD_COLOR = "#3C3489"; // niños siempre en morado

/** Umbrales de color por nº de personas (barra de cupo y gráfico). */
export const THRESHOLD_HEX = {
  green: "#639922", // < 10
  amber: "#EF9F27", // 10–15
  red: "#E24B4A", //   ≥ 16 (dividir / varias salidas)
} as const;

export type ColorLevel = keyof typeof THRESHOLD_HEX;

export function capacityLevel(pax: number): ColorLevel {
  if (pax < 10) return "green";
  if (pax <= 15) return "amber";
  return "red";
}

export function capacityHex(pax: number): string {
  return THRESHOLD_HEX[capacityLevel(pax)];
}

/** ≥ 16 personas ⇒ hay que dividir la franja en varias salidas. */
export function needsSplit(pax: number): boolean {
  return pax >= 16;
}

// ── Punto de salida / monitor (§3.1) ───────────────────────────────────

/** Cala Santanyí (producto "Es Pontàs") sale de otra playa y con monitor aparte. */
export function isSantanyi(locationName?: string | null, productName?: string | null): boolean {
  const hay = `${locationName ?? ""} ${productName ?? ""}`.toLowerCase();
  return /santany|pont[àa]s|pontas/.test(hay);
}

// ── Precios en efectivo y caja (§3.2 y §3.3) ───────────────────────────

export type CashRate = { adult: number; child: number };

/** Tarifas por canal de efectivo (€/persona). */
export const CASH_RATES: Record<string, CashRate> = {
  hotel: { adult: 45, child: 25 }, // vale ROIG
  directa: { adult: 40, child: 20 },
  whatsapp: { adult: 40, child: 20 },
  instagram: { adult: 40, child: 20 },
  privada: { adult: 40, child: 20 }, // salvo tarifa propia (p. ej. ~200 €)
};

/** Canales cuyo efectivo entra en la caja de playa. */
export const CASH_CHANNELS = ["Hotel", "WhatsApp", "Instagram", "Directa", "Privada"] as const;

/** Fuentes ya cobradas por plataforma: NUNCA entran en caja (aparecen "✓ pagado"). */
export const PLATFORM_SOURCES = ["getyourguide", "bokun_viator", "freedome"] as const;

function channelKey(channel?: string | null): string {
  return (channel ?? "").trim().toLowerCase();
}

export function cashRateForChannel(channel?: string | null): CashRate {
  return CASH_RATES[channelKey(channel)] ?? CASH_RATES.directa;
}

/** ¿El canal cobra en efectivo en playa (y por tanto suma a caja)? */
export function isCashChannel(channel?: string | null): boolean {
  return channelKey(channel) in CASH_RATES;
}

/**
 * Importe en efectivo calculado por canal. Las privadas con tarifa propia se
 * pasan como `override`; si es null se calcula por pax. Devuelve null cuando no
 * hay canal de efectivo reconocido (queda pendiente, no suma).
 */
export function computeCashAmount(
  channel: string | null | undefined,
  paxAdults: number,
  paxChildren: number,
): number | null {
  if (!isCashChannel(channel)) return null;
  const rate = cashRateForChannel(channel);
  return paxAdults * rate.adult + paxChildren * rate.child;
}

// ── Badges por canal (§4) ──────────────────────────────────────────────

export type Badge = { label: string; bg: string; fg: string };

const CHANNEL_BADGES: Record<string, Badge> = {
  getyourguide: { label: "GYG", bg: "#E8F0FE", fg: "#1A56DB" }, // azul
  gyg: { label: "GYG", bg: "#E8F0FE", fg: "#1A56DB" },
  viator: { label: "Viator", bg: "#FDECC8", fg: "#B45309" }, // ámbar
  freedome: { label: "Freedome", bg: "#D7F0EC", fg: "#00695C" }, // teal
  hotel: { label: "Hotel", bg: "#E9EDD6", fg: "#5A6B1E" }, // oliva
  whatsapp: { label: "WhatsApp", bg: "#FCE4EC", fg: "#C2185B" }, // rosa
  instagram: { label: "Instagram", bg: "#FBE3F4", fg: "#A21CAF" }, // fucsia
  directa: { label: "Directa", bg: "#EEF1F4", fg: "#475569" }, // neutro
  privada: { label: "Privada", bg: "#EDE9FE", fg: "#6D28D9" }, // morado suave
};

export const MONITOR_BADGE: Badge = { label: "⚓ monitor aparte", bg: "#EDE9FE", fg: "#4C1D95" };

/**
 * Badge de un canal. Mapea la fuente/canal libre de la reserva a su color fijo;
 * si es un canal desconocido devuelve un badge neutro con el texto original.
 */
export function channelBadge(channel?: string | null, source?: string | null): Badge {
  const key = channelKey(channel);
  if (key && CHANNEL_BADGES[key]) return CHANNEL_BADGES[key];
  // Viator llega con nombres de marketplace variables pero source bokun_viator.
  if (source === "bokun_viator") return CHANNEL_BADGES.viator;
  if (source && CHANNEL_BADGES[source]) return CHANNEL_BADGES[source];
  return { label: channel || source || "—", bg: "#EEF1F4", fg: "#475569" };
}
