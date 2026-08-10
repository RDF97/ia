import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { syncMyProfile } from "./profiles";
import { getPerfilIcon } from "./appearance";

/**
 * Publica mi ficha (nombre e icono) en el hogar para que los demás la vean.
 *
 * Hace falta porque Appwrite no deja leer el nombre de otra cuenta desde la
 * app: sin esto todos aparecen como "Miembro sin nombre" y no hay con quién
 * repartir gastos ni a quién asignar tareas.
 *
 * Se ejecuta al entrar y cada vez que cambio de nombre. `syncMyProfile` solo
 * escribe si algo cambió, así que un arranque normal no toca la base de datos.
 */
export function useProfileSync(
  hogarId: string | undefined,
  userId: string | undefined,
  name: string,
  accentColor: string,
): void {
  const qc = useQueryClient();

  useEffect(() => {
    if (!hogarId || !userId || !name.trim()) return;
    let cancelled = false;
    (async () => {
      const style = await getPerfilIcon(accentColor).catch(() => null);
      if (cancelled) return;
      await syncMyProfile(hogarId, userId, name, {
        icon: style?.icon ?? null,
        iconColor: style?.color ?? null,
      });
      if (cancelled) return;
      // Que la lista de miembros recoja el nombre recién publicado.
      qc.invalidateQueries({ queryKey: ["members", hogarId] });
    })();
    return () => {
      cancelled = true;
    };
  }, [hogarId, userId, name, accentColor, qc]);
}
