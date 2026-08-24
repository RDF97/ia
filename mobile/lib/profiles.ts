import { Permission, Query, Role, type Models } from "react-native-appwrite";
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

/**
 * Identificador FIJO de la ficha de alguien en un hogar.
 *
 * Antes era `ID.unique()`, y eso escondía el fallo que nos ha tenido dando
 * vueltas: si la consulta de "¿tengo ya ficha?" devolvía vacío —da igual si por
 * permisos o porque no había ninguna—, la app creaba otra. En cada arranque.
 * Escribía bien, nadie veía un error, y la base de datos se iba llenando de
 * fichas repetidas mientras todos seguían como "Miembro sin nombre".
 *
 * Con un id fijo, la ficha de una persona en un hogar es UNA, siempre la misma:
 * repetirla es imposible, y se puede pedir directamente por su id sin depender
 * de que la consulta por atributos funcione.
 *
 * Appwrite admite 36 caracteres, y los ids que genera son de 20: caben el del
 * usuario entero y los primeros 15 del hogar, de sobra para no chocar.
 */
export const profileDocId = (hogarId: string, userId: string): string =>
  `${userId}_${hogarId.slice(0, 15)}`;

/** Cómo fue leer las fichas, para poder decirlo en pantalla en vez de callarlo. */
export type ProfilesRead = { people: HouseholdPerson[]; error: string | null };

const toPerson = (d: Profile): HouseholdPerson => ({
  userId: d.userId,
  name: (d.name || "").trim(),
  icon: d.icon ?? null,
  iconColor: d.iconColor ?? null,
});

/**
 * Las fichas del hogar.
 *
 * Se buscan por dos caminos porque cada uno falla de una forma distinta:
 *
 *  · La consulta por `hogarId` las trae todas de una vez, incluidas las viejas
 *    con id aleatorio, pero necesita permiso para listar y depende del índice.
 *  · Pedir cada ficha por su id fijo no necesita ni lo uno ni lo otro, pero solo
 *    encuentra las nuevas y hace falta saber de antemano los `userId`.
 *
 * Se hacen los dos y se junta el resultado. Con uno que funcione, hay nombres.
 */
export async function readProfiles(hogarId: string, userIds: string[] = []): Promise<ProfilesRead> {
  let error: string | null = null;

  const porConsulta = await databases
    .listDocuments<Profile>(DB_ID, PROFILES_COL, [Query.equal("hogarId", hogarId), Query.limit(50)])
    .then((r) => r.documents.map(toPerson))
    .catch((e) => {
      error = describeProfileError(e);
      return [] as HouseholdPerson[];
    });

  const porId = await Promise.all(
    userIds.map((uid) =>
      databases
        .getDocument<Profile>(DB_ID, PROFILES_COL, profileDocId(hogarId, uid))
        .then(toPerson)
        // Que no exista es normal (ficha vieja o persona que aún no ha entrado):
        // no es un error que merezca contarse en pantalla.
        .catch(() => null),
    ),
  );

  const porUsuario = new Map<string, HouseholdPerson>();
  for (const p of [...porConsulta, ...porId.filter((p): p is HouseholdPerson => !!p)]) {
    if (p.userId && p.name) porUsuario.set(p.userId, p);
  }
  const people = [...porUsuario.values()];
  // Si por algún camino salieron nombres, no hay nada que contar.
  return { people, error: people.length ? null : error };
}

export async function listProfiles(hogarId: string, userIds: string[] = []): Promise<HouseholdPerson[]> {
  return (await readProfiles(hogarId, userIds)).people;
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
  return upsertProfile(hogarId, userId, data);
}

/**
 * Escribe una ficha en su id fijo: primero intenta actualizar y, si no existe,
 * la crea.
 *
 * Ese orden importa. Al revés —crear y si falla actualizar— cada arranque
 * empezaría con un error en el registro de Appwrite, y lo normal es que la ficha
 * ya exista. Y sobre todo: aquí no se consulta antes "¿existe?", porque esa
 * consulta puede devolver vacío por permisos y hacer creer que no hay nada.
 * Es exactamente lo que llenaba la base de datos de fichas repetidas.
 */
async function upsertProfile(
  hogarId: string,
  userId: string,
  data: Record<string, string | null>,
): Promise<ProfileSyncResult> {
  const id = profileDocId(hogarId, userId);
  const perms = [
    Permission.read(Role.team(hogarId)),
    Permission.update(Role.team(hogarId)),
    Permission.delete(Role.team(hogarId)),
    // Y además a nombre propio: sin esto, si la membresía del equipo no está
    // confirmada Appwrite no da el rol del hogar y esa persona no podía leer ni
    // su PROPIA ficha, así que se veía a sí misma como "Miembro sin nombre".
    Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
  ];
  try {
    await databases.updateDocument(DB_ID, PROFILES_COL, id, data);
    return { ok: true };
  } catch (eUpdate) {
    try {
      await databases.createDocument(DB_ID, PROFILES_COL, id, data, perms);
      return { ok: true };
    } catch (eCreate) {
      // Si la creación falla por existir ya, manda el fallo de la actualización:
      // ese es el que dice de verdad qué pasa (permisos, columna que falta…).
      const msg = String((eCreate as { message?: string })?.message ?? "");
      return { ok: false, error: describeProfileError(/exist/i.test(msg) ? eUpdate : eCreate) };
    }
  }
}

/**
 * Pone el nombre de OTRA persona del hogar.
 *
 * Normalmente cada uno publica su propia ficha al entrar. Pero eso depende de
 * que su móvil tenga una versión de la app que lo haga, y mientras no la tenga
 * no hay manera de saber cómo se llama: Appwrite no lo cuenta, y esa persona
 * aparece como "Miembro sin nombre" sin que nadie pueda hacer nada.
 *
 * Quien está mirando la pantalla sí sabe quién es. Esto le deja escribirlo. La
 * ficha se guarda con permisos del hogar, así que la otra persona la puede
 * corregir después desde su móvil sin problemas.
 */
export async function setProfileName(
  hogarId: string,
  userId: string,
  name: string,
): Promise<ProfileSyncResult> {
  const clean = name.trim();
  if (!hogarId || !userId || !clean) return { ok: true, skipped: true };
  // Solo el nombre: el icono es cosa suya, que lo elija ella desde su móvil.
  return upsertProfile(hogarId, userId, { hogarId, userId, name: clean });
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
