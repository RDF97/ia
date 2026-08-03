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
  "bed", "cafe", "pizza", "restaurant", "wine", "tv",
  "musical-notes", "football", "fitness", "airplane", "car-sport", "umbrella",
  "snow", "flame", "diamond", "gift", "balloon", "key",
];

export const PERFIL_ICONS: IoniconName[] = [
  "person", "happy", "glasses", "rocket", "musical-notes", "football",
  "game-controller", "camera", "book", "cafe", "bulb", "planet",
  "paw", "heart", "star", "flash", "leaf", "flower",
  "bicycle", "boat", "airplane", "medkit", "brush", "code-slash",
  "headset", "ice-cream", "pizza", "beer", "trophy", "moon",
];

export const ICON_COLORS = [
  "#1F4D52", "#2A6E75", "#00C7BE", "#34C759", "#30D158", "#8BC34A",
  "#5AC8FA", "#007AFF", "#5856D6", "#AF52DE", "#BF5AF2", "#FF2D55",
  "#FF3B30", "#FF6B35", "#FF9500", "#FFCC00", "#A2845E", "#8E8E93",
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
  try {
    // Ojo: hay que conservar el resto (p. ej. budgetEnabled), updatePrefs reemplaza.
    await teams.updatePrefs(hogarId, { ...prefs, icon: style.icon, iconColor: style.color });
  } catch (e) {
    // Las preferencias del equipo solo las puede cambiar quien tiene rol de
    // propietario; para el resto explicamos por qué en vez de soltar el error crudo.
    const msg = String((e as { message?: string })?.message ?? e);
    if (/unauthor|permission|scope|missing/i.test(msg)) {
      throw new Error(
        "El icono del hogar solo lo puede cambiar quien lo creó. El icono de tu perfil sí puedes cambiarlo.",
      );
    }
    throw e;
  }
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
