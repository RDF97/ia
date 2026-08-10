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
  "bonfire", "business", "storefront", "cart", "basket", "bag-handle",
  "shield", "ribbon", "rose", "nutrition", "fast-food", "ice-cream",
  "wifi", "bulb", "hammer", "construct", "color-palette", "school",
  "library", "earth", "map", "compass", "telescope", "planet",
];

export const PERFIL_ICONS: IoniconName[] = [
  "person", "happy", "glasses", "rocket", "musical-notes", "football",
  "game-controller", "camera", "book", "cafe", "bulb", "planet",
  "paw", "heart", "star", "flash", "leaf", "flower",
  "bicycle", "boat", "airplane", "medkit", "brush", "code-slash",
  "headset", "ice-cream", "pizza", "beer", "trophy", "moon",
  "sunny", "snow", "flame", "diamond", "shield", "ribbon",
  "barbell", "bandage", "basketball", "tennisball", "golf", "bowling-ball",
  "american-football", "baseball", "body", "walk", "bicycle-outline", "car-sport",
  "bus", "train", "subway", "rocket-outline", "telescope", "earth",
  "watch", "headset-outline", "mic", "disc", "film", "tv",
  "laptop", "phone-portrait", "hardware-chip", "terminal", "magnet", "key",
];

/**
 * Paleta de personalización, ordenada por tono (verdes → azules → morados →
 * rojos → naranjas → neutros) para que la cuadrícula se lea como un degradado
 * y no como una bolsa de colores sueltos.
 *
 * Todos tienen contraste de sobra con el icono blanco que va encima: los tonos
 * muy claros (amarillos y pasteles) van en versión oscurecida a propósito.
 */
export const ICON_COLORS = [
  // Verdes y turquesas
  "#1F4D52", "#2A6E75", "#00A99D", "#00C7BE", "#1F8C4D", "#34C759",
  "#8BC34A", "#5B8C00",
  // Azules
  "#5AC8FA", "#0A84FF", "#007AFF", "#0055B8", "#1B3A6B", "#3F7CAC",
  // Morados y rosas
  "#5856D6", "#7D5FFF", "#AF52DE", "#BF5AF2", "#C56CF0", "#8E44AD",
  "#FF2D55", "#FF6B9D", "#D81B60",
  // Rojos y naranjas
  "#FF3B30", "#C0392B", "#FF6B35", "#FF9500", "#E67E22", "#D4A017",
  // Tierra y neutros
  "#A2845E", "#7D6608", "#6D4C41", "#5D4037", "#48484A", "#8E8E93",
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
