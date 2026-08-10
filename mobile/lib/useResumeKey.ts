import { useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

/** Segundos en segundo plano a partir de los cuales se vuelve a montar la vista. */
export const REMOUNT_AFTER_SECONDS = 3;

/**
 * ¿Hay que volver a montar la vista al regresar del segundo plano?
 *
 * Se pasa de `background` a `active`, y se compara cuánto tiempo estuvo fuera.
 * `inactive` NO cuenta: en iOS ocurre al bajar el centro de control o al recibir
 * una llamada, y no hay nada que recomponer.
 */
export function shouldRemount(
  prev: AppStateStatus,
  next: AppStateStatus,
  awaySeconds: number,
): boolean {
  return prev === "background" && next === "active" && awaySeconds >= REMOUNT_AFTER_SECONDS;
}

/**
 * Clave que cambia al volver de segundo plano tras un rato fuera.
 *
 * Sirve para colgarla de un `key` y forzar que el árbol se vuelva a montar. Es
 * la red de seguridad contra la pantalla en blanco al volver a la app: cuando
 * Android recicla la Activity, la superficie nativa puede quedarse colgada y
 * hasta ahora la única salida era forzar el cierre. Volviendo a montar, la vista
 * se reconstruye sola.
 *
 * Los datos no se pierden: vienen de la caché de react-query, y expo-router
 * conserva la ruta, así que se vuelve a la misma pestaña.
 *
 * El mínimo de segundos evita recomponer al cambiar un momento de app.
 */
export function useResumeKey(): number {
  const [key, setKey] = useState(0);
  const state = useRef<AppStateStatus>(AppState.currentState);
  const since = useRef<number>(Date.now());

  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      const prev = state.current;
      const away = (Date.now() - since.current) / 1000;
      if (next !== prev) {
        state.current = next;
        since.current = Date.now();
      }
      if (shouldRemount(prev, next, away)) setKey((k) => k + 1);
    };
    const sub = AppState.addEventListener("change", onChange);
    return () => sub.remove();
  }, []);

  return key;
}
