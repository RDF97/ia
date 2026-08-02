import { ID, Permission, Query, Role, type Models } from "react-native-appwrite";
import { DB_ID, PRICES_COL, PRODUCTS_COL, databases } from "./db";

export interface Product extends Models.Document {
  name: string;
  hogarId: string;
  lastPrice?: number | null;
  lastStore?: string | null;
  lastAt?: string | null;
}

export interface PricePoint extends Models.Document {
  productId: string;
  price: number;
  store: string;
  at: string; // ISO datetime
  hogarId: string;
}

const teamPerms = (hogarId: string) => [
  Permission.read(Role.team(hogarId)),
  Permission.update(Role.team(hogarId)),
  Permission.delete(Role.team(hogarId)),
];

export const normalizeName = (name: string): string => name.trim().replace(/\s+/g, " ");

export async function listProducts(hogarId: string): Promise<Product[]> {
  const res = await databases.listDocuments<Product>(DB_ID, PRODUCTS_COL, [
    Query.equal("hogarId", hogarId),
    Query.orderDesc("lastAt"),
    Query.limit(500),
  ]);
  return res.documents;
}

export async function findOrCreateProduct(hogarId: string, rawName: string): Promise<Product> {
  const name = normalizeName(rawName);
  const existing = await databases.listDocuments<Product>(DB_ID, PRODUCTS_COL, [
    Query.equal("hogarId", hogarId),
    Query.equal("name", name),
    Query.limit(1),
  ]);
  if (existing.documents.length > 0) return existing.documents[0];
  return databases.createDocument<Product>(
    DB_ID,
    PRODUCTS_COL,
    ID.unique(),
    { name, hogarId, lastPrice: null, lastStore: null, lastAt: null },
    teamPerms(hogarId),
  );
}

/** Registra un precio para un producto y actualiza su "último precio". */
export async function recordPrice(
  hogarId: string,
  productName: string,
  price: number,
  store: string,
): Promise<void> {
  const product = await findOrCreateProduct(hogarId, productName);
  const at = new Date().toISOString();
  await databases.createDocument<PricePoint>(
    DB_ID,
    PRICES_COL,
    ID.unique(),
    { productId: product.$id, price, store: normalizeName(store), at, hogarId },
    teamPerms(hogarId),
  );
  await databases.updateDocument<Product>(DB_ID, PRODUCTS_COL, product.$id, {
    lastPrice: price,
    lastStore: normalizeName(store),
    lastAt: at,
  });
}

/** Borra un producto de la base de precios y todo su histórico de precios. */
export async function deleteProduct(productId: string): Promise<void> {
  // Primero los precios (si falla alguno seguimos: mejor dejarlo limpio a medias
  // que dejar el producto colgado).
  try {
    const points = await databases.listDocuments<PricePoint>(DB_ID, PRICES_COL, [
      Query.equal("productId", productId),
      Query.limit(500),
    ]);
    for (const p of points.documents) {
      try {
        await databases.deleteDocument(DB_ID, PRICES_COL, p.$id);
      } catch {
        /* seguimos con el resto */
      }
    }
  } catch {
    /* sin histórico o sin permiso de listado */
  }
  await databases.deleteDocument(DB_ID, PRODUCTS_COL, productId);
}

/** Borra un precio concreto del histórico. */
export async function deletePricePoint(id: string): Promise<void> {
  await databases.deleteDocument(DB_ID, PRICES_COL, id);
}

export async function listPricePoints(productId: string): Promise<PricePoint[]> {
  const res = await databases.listDocuments<PricePoint>(DB_ID, PRICES_COL, [
    Query.equal("productId", productId),
    Query.orderDesc("at"),
    Query.limit(200),
  ]);
  return res.documents;
}

// --- Lógica pura (testeable) ---

export interface StorePrice {
  store: string;
  price: number;
  at: string;
}

/**
 * Último precio conocido por supermercado, ordenado de más barato a más caro.
 * `points` debe venir ordenado de más reciente a más antiguo.
 */
export function latestByStore(points: Pick<PricePoint, "store" | "price" | "at">[]): StorePrice[] {
  const seen = new Map<string, StorePrice>();
  for (const p of points) {
    const key = p.store.toLowerCase();
    if (!seen.has(key)) seen.set(key, { store: p.store, price: p.price, at: p.at });
  }
  return [...seen.values()].sort((a, b) => a.price - b.price);
}
