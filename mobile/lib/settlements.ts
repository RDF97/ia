import { ID, Permission, Query, Role, type Models } from "react-native-appwrite";
import { client } from "./appwrite";
import { DB_ID, SETTLEMENTS_COL, databases } from "./db";

/**
 * Una liquidación: pago en efectivo/transferencia de una persona a otra para
 * saldar la deuda de gastos compartidos. NO es un gasto (no infla el total del
 * mes ni el presupuesto): solo ajusta "quién debe a quién".
 */
export interface Settlement extends Models.Document {
  fromName: string; // quien paga (salda su deuda)
  toName: string; // quien cobra
  amount: number;
  hogarId: string;
  at: string; // ISO
}

const teamPerms = (hogarId: string) => [
  Permission.read(Role.team(hogarId)),
  Permission.update(Role.team(hogarId)),
  Permission.delete(Role.team(hogarId)),
];

export async function listSettlements(hogarId: string): Promise<Settlement[]> {
  const res = await databases.listDocuments<Settlement>(DB_ID, SETTLEMENTS_COL, [
    Query.equal("hogarId", hogarId),
    Query.orderDesc("at"),
    Query.limit(200),
  ]);
  return res.documents;
}

export async function recordSettlement(
  hogarId: string,
  fromName: string,
  toName: string,
  amount: number,
): Promise<Settlement> {
  return databases.createDocument<Settlement>(
    DB_ID,
    SETTLEMENTS_COL,
    ID.unique(),
    { fromName, toName, amount, hogarId, at: new Date().toISOString() },
    teamPerms(hogarId),
  );
}

export async function deleteSettlement(id: string): Promise<void> {
  await databases.deleteDocument(DB_ID, SETTLEMENTS_COL, id);
}

export function subscribeSettlements(onChange: () => void): () => void {
  return client.subscribe(
    `databases.${DB_ID}.collections.${SETTLEMENTS_COL}.documents`,
    () => onChange(),
  );
}
