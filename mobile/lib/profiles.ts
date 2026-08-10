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

/**
 * Deja mi ficha al día. Se llama al entrar y al cambiarme el nombre.
 * No lanza: que falle no puede impedir usar la app.
 */
export async function syncMyProfile(
  hogarId: string,
  userId: string,
  name: string,
  style?: { icon?: string | null; iconColor?: string | null },
): Promise<void> {
  const clean = name.trim();
  if (!hogarId || !userId || !clean) return;
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
      return;
    }
    await databases.createDocument(DB_ID, PROFILES_COL, ID.unique(), data, [
      Permission.read(Role.team(hogarId)),
      Permission.update(Role.team(hogarId)),
      Permission.delete(Role.team(hogarId)),
    ]);
  } catch {
    /* sin colección seguimos con los nombres que dé Appwrite (vacíos) */
  }
}
