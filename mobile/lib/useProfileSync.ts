import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { teams } from "./appwrite";
import { syncMyProfile, type ProfileSyncResult } from "./profiles";
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
      // Los miembros se piden aquí a pelo, no con el hook de react-query: este
      // efecto invalida esa consulta al terminar, y leerla desde aquí montaría
      // un ciclo de refresco sin fin.
      const memberIds = await memberUserIds(hogarId);
      if (cancelled) return;
      const res = await syncMyProfile(
        hogarId,
        userId,
        name,
        { icon: style?.icon ?? null, iconColor: style?.color ?? null },
        memberIds,
      );
      if (cancelled) return;
      // El fallo se guarda para que Perfil pueda enseñarlo: si no, el hogar
      // sale lleno de "Miembro sin nombre" y nada dice que la causa está en
      // la base de datos, no en que el otro no haya abierto la app.
      setProfileSyncError(res.ok ? null : res.error);
      // Solo si se escribió algo: invalidar cuando no ha cambiado nada es
      // trabajo de red para nada en cada arranque.
      if (res.ok && !res.skipped) qc.invalidateQueries({ queryKey: ["members", hogarId] });
    })();
    return () => {
      cancelled = true;
    };
  }, [hogarId, userId, name, accentColor, qc]);
}

// --- Último resultado de la publicación, para poder enseñarlo en Perfil ---

let lastError: string | null = null;
const oyentes = new Set<(e: string | null) => void>();

function setProfileSyncError(e: string | null) {
  lastError = e;
  for (const o of oyentes) o(e);
}

/** El fallo de la última publicación de mi ficha, o null si fue bien. */
export function useProfileSyncError(): string | null {
  const [error, setError] = useState<string | null>(lastError);
  useEffect(() => {
    oyentes.add(setError);
    setError(lastError);
    return () => {
      oyentes.delete(setError);
    };
  }, []);
  return error;
}

/**
 * Reintenta publicar la ficha ahora mismo. Sirve para justo después de arreglar
 * la base de datos: sin esto habría que cerrar y volver a abrir la app para que
 * se reintentara, y no es evidente que haya que hacerlo.
 */
export async function retryProfileSync(
  hogarId: string,
  userId: string,
  name: string,
  accentColor: string,
): Promise<ProfileSyncResult> {
  const style = await getPerfilIcon(accentColor).catch(() => null);
  const res = await syncMyProfile(
    hogarId,
    userId,
    name,
    { icon: style?.icon ?? null, iconColor: style?.color ?? null },
    await memberUserIds(hogarId),
  );
  setProfileSyncError(res.ok ? null : res.error);
  return res;
}

/**
 * Los `userId` de quienes están en el hogar, para dar a cada uno permiso de
 * lectura sobre mi ficha. Si falla, se sigue sin ellos: la ficha se guarda
 * igual con los permisos del equipo, que es lo que había hasta ahora.
 */
async function memberUserIds(hogarId: string): Promise<string[]> {
  try {
    const res = await teams.listMemberships(hogarId);
    return res.memberships.map((m) => m.userId).filter(Boolean);
  } catch {
    return [];
  }
}
