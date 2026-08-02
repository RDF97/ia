import { account, teams } from "./appwrite";
import type { IoniconName } from "@/components/ui";

/**
 * Iconos y colores personalizables del perfil y del hogar.
 *
 * Se guardan en las *preferencias* de Appwrite: las del hogar en las del equipo
 * (así las ven todos los miembros) y las del perfil en las de la cuenta.
 * No hace falta ninguna colección nueva.
 */

export interface IconStyle {
  icon: IoniconName;
  color: string;
}

export const HOGAR_ICONS: IoniconName[] = [
  "home", "heart", "people", "paw", "leaf", "sunny",
  "moon", "star", "flower", "beer", "boat", "bicycle",
];

export const PERFIL_ICONS: IoniconName[] = [
  "person", "happy", "glasses", "rocket", "musical-notes", "football",
  "game-controller", "camera", "book", "cafe", "bulb", "planet",
];

export const ICON_COLORS = [
  "#1F4D52", "#34C759", "#5AC8FA", "#007AFF", "#5856D6", "#AF52DE",
  "#FF2D55", "#FF3B30", "#FF9500", "#FFCC00", "#8E8E93", "#00C7BE",
];

const isColor = (v: unknown): v is string => typeof v === "string" && /^#[0-9A-Fa-f]{6}$/.test(v);

/** Lee un IconStyle de un objeto de preferencias, con valores por defecto. */
export function readIconStyle(
  prefs: Record<string, unknown> | null | undefined,
  keyIcon: string,
  keyColor: string,
  fallback: IconStyle,
): IconStyle {
  const icon = prefs?.[keyIcon];
  const color = prefs?.[keyColor];
  return {
    icon: (typeof icon === "string" && icon ? icon : fallback.icon) as IoniconName,
    color: isColor(color) ? color : fallback.color,
  };
}

// --- Hogar (preferencias del equipo: compartidas) ---

export async function getHogarIcon(hogarId: string, fallbackColor: string): Promise<IconStyle> {
  try {
    const prefs = (await teams.getPrefs(hogarId)) as Record<string, unknown>;
    return readIconStyle(prefs, "icon", "iconColor", { icon: "home", color: fallbackColor });
  } catch {
    return { icon: "home", color: fallbackColor };
  }
}

export async function setHogarIcon(hogarId: string, style: IconStyle): Promise<void> {
  let prefs: Record<string, unknown> = {};
  try {
    prefs = (await teams.getPrefs(hogarId)) as Record<string, unknown>;
  } catch {
    /* sin prefs previas */
  }
  // Ojo: hay que conservar el resto (p. ej. budgetEnabled), updatePrefs reemplaza.
  await teams.updatePrefs(hogarId, { ...prefs, icon: style.icon, iconColor: style.color });
}

// --- Perfil (preferencias de la cuenta) ---

export async function getPerfilIcon(fallbackColor: string): Promise<IconStyle | null> {
  try {
    const me = await account.get();
    const prefs = (me.prefs ?? {}) as Record<string, unknown>;
    if (!prefs.avatarIcon && !prefs.avatarColor) return null; // sin personalizar → iniciales
    return readIconStyle(prefs, "avatarIcon", "avatarColor", { icon: "person", color: fallbackColor });
  } catch {
    return null;
  }
}

export async function setPerfilIcon(style: IconStyle | null): Promise<void> {
  const me = await account.get();
  const prefs = { ...((me.prefs ?? {}) as Record<string, unknown>) };
  if (style === null) {
    delete prefs.avatarIcon;
    delete prefs.avatarColor;
  } else {
    prefs.avatarIcon = style.icon;
    prefs.avatarColor = style.color;
  }
  await account.updatePrefs(prefs);
}
