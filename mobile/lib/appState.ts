import { AppState, type AppStateStatus } from "react-native";
import { focusManager, onlineManager, type QueryClient } from "@tanstack/react-query";

/**
 * Conecta el ciclo de vida de la app con react-query.
 *
 * En móvil no existe el "focus" del navegador, así que hay que avisar a mano:
 * al volver del segundo plano se marca como enfocada y se refrescan los datos.
 * Sin esto, al volver a la app se quedan los datos viejos (o vacíos) hasta que
 * tiras de la pantalla para recargar.
 */
export function wireAppState(qc: QueryClient): () => void {
  onlineManager.setEventListener((setOnline) => {
    setOnline(true); // en RN asumimos conexión; los errores ya se manejan por query
    return () => undefined;
  });

  const onChange = (status: AppStateStatus) => {
    const activeNow = status === "active";
    focusManager.setFocused(activeNow);
    if (activeNow) {
      // Vuelve del segundo plano: refresca lo que esté montado.
      qc.invalidateQueries({ refetchType: "active" }).catch(() => undefined);
    }
  };

  const sub = AppState.addEventListener("change", onChange);
  return () => sub.remove();
}
