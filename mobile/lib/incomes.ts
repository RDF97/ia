import { ID, Permission, Query, Role, type Models } from "react-native-appwrite";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DB_ID, INCOMES_COL, databases } from "./db";

/**
 * Ingreso mensual de cada miembro del hogar.
 *
 * Se guarda en una colección propia porque el hogar tiene que verlo: con las
 * preferencias de la cuenta cada uno solo puede leer las suyas, y con las del
 * equipo solo puede escribir quien lo creó.
 *
 * Además se guarda una copia local del ingreso PROPIO. Así el dato no se pierde
 * si la colección todavía no existe (hasta que se pase el script de Appwrite) y
 * la tarjeta sigue funcionando sin conexión.
 */
export interface Income extends Models.Document {
  hogarId: string;
  userName: string;
  amount: number;
}

const LOCAL = (hogarId: string) => `income:${hogarId}`;

const clean = (v: number): number => (Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : 0);

async function getLocal(hogarId: string): Promise<number> {
  const raw = await AsyncStorage.getItem(LOCAL(hogarId)).catch(() => null);
  return raw === null ? 0 : clean(parseFloat(raw));
}

/** Ingreso de cada persona del hogar, por nombre. */
export async function listIncomes(hogarId: string, myName: string): Promise<Record<string, number>> {
  const local = await getLocal(hogarId);
  const out: Record<string, number> = {};
  if (local > 0 && myName) out[myName] = local;
  try {
    const res = await databases.listDocuments<Income>(DB_ID, INCOMES_COL, [
      Query.equal("hogarId", hogarId),
      Query.limit(50),
    ]);
    // Lo compartido manda sobre la copia local: es lo que ve todo el hogar.
    for (const d of res.documents) if (d.userName) out[d.userName] = clean(d.amount);
  } catch {
    /* la colección aún no existe: se sigue con la copia local */
  }
  return out;
}

/** Guarda MI ingreso. 0 lo borra. Nunca lanza por el guardado compartido. */
export async function saveIncome(hogarId: string, userName: string, amount: number): Promise<void> {
  const value = clean(amount);
  await AsyncStorage.setItem(LOCAL(hogarId), String(value)).catch(() => undefined);
  try {
    const res = await databases.listDocuments<Income>(DB_ID, INCOMES_COL, [
      Query.equal("hogarId", hogarId),
      Query.equal("userName", userName),
      Query.limit(1),
    ]);
    const mine = res.documents[0];
    if (value === 0) {
      if (mine) await databases.deleteDocument(DB_ID, INCOMES_COL, mine.$id);
      return;
    }
    if (mine) {
      await databases.updateDocument(DB_ID, INCOMES_COL, mine.$id, { amount: value });
      return;
    }
    await databases.createDocument(
      DB_ID,
      INCOMES_COL,
      ID.unique(),
      { hogarId, userName, amount: value },
      [
        Permission.read(Role.team(hogarId)),
        Permission.update(Role.team(hogarId)),
        Permission.delete(Role.team(hogarId)),
      ],
    );
  } catch {
    /* sin colección el ingreso queda solo en este móvil, pero no se pierde */
  }
}
