import { ID, Permission, Query, Role, type Models } from "react-native-appwrite";
import { client } from "./appwrite";
import { DB_ID, SHOPPING_COL, databases } from "./db";

export interface ShoppingItem extends Models.Document {
  name: string;
  qty?: string | null;
  store?: string | null;
  done: boolean;
  hogarId: string;
  createdByName: string;
}

export async function listShopping(hogarId: string): Promise<ShoppingItem[]> {
  const res = await databases.listDocuments<ShoppingItem>(DB_ID, SHOPPING_COL, [
    Query.equal("hogarId", hogarId),
    Query.orderDesc("$createdAt"),
    Query.limit(200),
  ]);
  return res.documents;
}

export async function addItem(
  hogarId: string,
  name: string,
  createdByName: string,
  qty?: string,
  store?: string,
): Promise<ShoppingItem> {
  return databases.createDocument<ShoppingItem>(
    DB_ID,
    SHOPPING_COL,
    ID.unique(),
    { name, qty: qty || null, store: store || null, done: false, hogarId, createdByName },
    [
      Permission.read(Role.team(hogarId)),
      Permission.update(Role.team(hogarId)),
      Permission.delete(Role.team(hogarId)),
    ],
  );
}

export async function setItemDone(item: ShoppingItem, done: boolean): Promise<ShoppingItem> {
  return databases.updateDocument<ShoppingItem>(DB_ID, SHOPPING_COL, item.$id, { done });
}

export async function deleteItem(id: string): Promise<void> {
  await databases.deleteDocument(DB_ID, SHOPPING_COL, id);
}

export function subscribeShopping(onChange: () => void): () => void {
  return client.subscribe(
    `databases.${DB_ID}.collections.${SHOPPING_COL}.documents`,
    () => onChange(),
  );
}
