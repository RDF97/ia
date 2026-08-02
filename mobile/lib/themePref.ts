import AsyncStorage from "@react-native-async-storage/async-storage";
import { colorScheme } from "nativewind";

/**
 * Preferencia de tema elegida por el usuario. "system" sigue al móvil.
 *
 * Se aplica con el colorScheme de NativeWind para que cambien a la vez el tema
 * de JS (useTheme) y las clases CSS (bg-card, text-label…).
 */
export type ThemeChoice = "system" | "light" | "dark";

const KEY = "theme-choice";

export const THEME_OPTIONS: { key: ThemeChoice; label: string }[] = [
  { key: "system", label: "Sistema" },
  { key: "light", label: "Claro" },
  { key: "dark", label: "Oscuro" },
];

const isChoice = (v: unknown): v is ThemeChoice =>
  v === "system" || v === "light" || v === "dark";

export async function getThemeChoice(): Promise<ThemeChoice> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return isChoice(raw) ? raw : "system";
  } catch {
    return "system";
  }
}

export function applyThemeChoice(choice: ThemeChoice): void {
  colorScheme.set(choice);
}

export async function setThemeChoice(choice: ThemeChoice): Promise<void> {
  applyThemeChoice(choice);
  try {
    await AsyncStorage.setItem(KEY, choice);
  } catch {
    /* si no se puede guardar, al menos queda aplicado en esta sesión */
  }
}

/** Aplica al arrancar la preferencia guardada. */
export async function initThemeChoice(): Promise<ThemeChoice> {
  const choice = await getThemeChoice();
  applyThemeChoice(choice);
  return choice;
}
