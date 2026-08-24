import { ID, Permission, Query, Role, type Models } from "react-native-appwrite";
import { DB_ID, PROFILES_COL, databases } from "./db";

/**
 * Ficha de cada persona dentro de un hogar: su nombre y su icono.
 *
 * Existe porque `teams.listMemberships` devuelve `userName` y `userEmail`
 * VACÍOS cuando lo pide la propia app: Appwrite no expone los datos de una
 * cuenta a los demás miembros del equipo, ni siquiera al que creó el hogar. Sin
 * esto, todos los miembros salían como "Miembro sin nombre", no se podía
 * asignar una tarea a nadie, y el reparto de gastos no sabía con quién repartir.
 *
 * Cada uno escribe SOLO su propia ficha (al entrar y al cambiarse el nombre) y
 * todo el hogar puede leerla.
 */
export interface Profile extends Models.Document {
  hogarId: string;
  userId: string;
  name: string;
  icon?: string | null;
  iconColor?: string | null;
}

export interface HouseholdPerson {
  userId: string;
  name: string;
  icon?: string | null;
  iconColor?: string | null;
}

export async function listProfiles(hogarId: string): Promise<HouseholdPerson[]> {
  try {
    const res = await databases.listDocuments<Profile>(DB_ID, PROFILES_COL, [
      Query.equal("hogarId", hogarId),
      Query.limit(50),
    ]);
    return res.documents
      .map((d) => ({
        userId: d.userId,
        name: (d.name || "").trim(),
        icon: d.icon ?? null,
        iconColor: d.iconColor ?? null,
      }))
      .filter((p) => p.userId && p.name);
  } catch {
    // La colección todavía no existe: se sigue con lo que dé Appwrite.
    return [];
  }
}

/** Cómo fue la publicación de mi ficha, para poder decirlo en pantalla. */
export type ProfileSyncResult =
  | { ok: true; skipped?: boolean }
  | { ok: false; error: string };

/**
 * Publica mi ficha en el hogar.
 *
 * Devuelve el resultado en vez de tragarse el fallo. Antes no lanzaba ni
 * informaba, así que si la colección `profiles` no existía o le faltaban
 * permisos, todos seguían saliendo como "Miembro sin nombre" sin que nada
 * dijera por qué, y no había manera de distinguirlo de "aún no ha abierto la
 * app". Eso es lo que hacía el problema imposible de arreglar desde fuera.
 */
export async function syncMyProfile(
  hogarId: string,
  userId: string,
  name: string,
  style?: { icon?: string | null; iconColor?: string | null },
): Promise<ProfileSyncResult> {
  const clean = name.trim();
  if (!hogarId || !userId || !clean) return { ok: true, skipped: true };
  const data: Record<string, string | null> = { hogarId, userId, name: clean };
  if (style) {
    data.icon = style.icon ?? null;
    data.iconColor = style.iconColor ?? null;
  }
  try {
    const res = await databases.listDocuments<Profile>(DB_ID, PROFILES_COL, [
      Query.equal("hogarId", hogarId),
      Query.equal("userId", userId),
      Query.limit(1),
    ]);
    const mine = res.documents[0];
    if (mine) {
      // Solo se escribe si algo cambió: si no, cada arranque sería una escritura.
      const same =
        mine.name === clean &&
        (!style || ((mine.icon ?? null) === (style.icon ?? null) && (mine.iconColor ?? null) === (style.iconColor ?? null)));
      if (!same) await databases.updateDocument(DB_ID, PROFILES_COL, mine.$id, data);
      return { ok: true };
    }
    await databases.createDocument(DB_ID, PROFILES_COL, ID.unique(), data, [
      Permission.read(Role.team(hogarId)),
      Permission.update(Role.team(hogarId)),
      Permission.delete(Role.team(hogarId)),
    ]);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: describeProfileError(e) };
  }
}

/**
 * Traduce el error de Appwrite a algo con lo que se pueda hacer algo. Los dos
 * casos reales son que la colección no exista (falta pasar el script) o que le
 * falten permisos de escritura para el rol `users`.
 */
export function describeProfileError(e: unknown): string {
  const msg = String((e as { message?: string })?.message ?? e);
  if (/not be found|not_found|collection with the requested id/i.test(msg)) {
    return "La colección \"profiles\" no existe todavía en Appwrite. Hay que pasar scripts/appwrite-setup.sh.";
  }
  if (/unauthor|permission|missing scope|not allowed/i.test(msg)) {
    return "La colección \"profiles\" existe pero no deja escribir. Vuelve a pasar scripts/appwrite-setup.sh, que arregla los permisos.";
  }
  if (/attribute/i.test(msg)) {
    return `A la colección "profiles" le falta alguna columna (${msg.slice(0, 120)}). Pasa scripts/appwrite-setup.sh.`;
  }
  return msg.slice(0, 200);
}
