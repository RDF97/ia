import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Red de seguridad para los errores que el ErrorBoundary NO puede ver.
 *
 * `<ErrorBoundary>` solo caza lo que revienta mientras React pinta. Un error en
 * un temporizador, en una promesa suelta o en el callback de una suscripción de
 * tiempo real ocurre FUERA de ese ciclo: React Native lo trata como fatal, mata
 * el hilo de JavaScript y la pantalla se queda en blanco sin nada pintado. La
 * app sigue "abierta" pero muerta, y la única salida es forzar el cierre — que
 * es exactamente el síntoma que hay que quitar.
 *
 * Aquí se intercepta ese manejador global: el error se guarda para poder verlo
 * después, se avisa a quien esté escuchando (para pintar la pantalla de error en
 * vez de dejarlo en blanco) y, si es fatal, NO se delega en el manejador por
 * defecto, que es justo el que tumba el hilo.
 */

export interface CrashInfo {
  message: string;
  stack: string;
  fatal: boolean;
  at: string;
}

const KEY = "last-crash";

type Listener = (info: CrashInfo) => void;
const listeners = new Set<Listener>();
let installed = false;

/** Avisa cuando llega un error fatal, para pintar algo en vez de nada. */
export function onFatal(cb: Listener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export async function getLastCrash(): Promise<CrashInfo | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CrashInfo) : null;
  } catch {
    return null;
  }
}

export async function clearLastCrash(): Promise<void> {
  await AsyncStorage.removeItem(KEY).catch(() => undefined);
}

type ErrorUtilsLike = {
  getGlobalHandler?: () => ((error: unknown, isFatal?: boolean) => void) | undefined;
  setGlobalHandler?: (h: (error: unknown, isFatal?: boolean) => void) => void;
};

export function installCrashGuard(): void {
  if (installed) return;
  const eu = (globalThis as unknown as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils;
  if (!eu?.setGlobalHandler) return;
  installed = true;

  const previous = eu.getGlobalHandler?.();

  eu.setGlobalHandler((error: unknown, isFatal?: boolean) => {
    const err = error instanceof Error ? error : new Error(String(error));
    const info: CrashInfo = {
      message: err.message || "Error desconocido",
      stack: String(err.stack ?? "").slice(0, 2000),
      fatal: !!isFatal,
      at: new Date().toISOString(),
    };

    AsyncStorage.setItem(KEY, JSON.stringify(info)).catch(() => undefined);
    for (const l of listeners) {
      try {
        l(info);
      } catch {
        /* un oyente roto no puede impedir manejar el error */
      }
    }

    // Los no fatales siguen su curso normal (se registran y ya).
    // Los fatales se quedan aquí a propósito: delegar en el manejador por
    // defecto es lo que deja la pantalla en blanco.
    if (!isFatal) previous?.(error, isFatal);
  });
}
