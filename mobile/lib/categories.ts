import { ID, Permission, Query, Role, type Models } from "react-native-appwrite";
import { client, teams } from "./appwrite";
import { CATEGORIES_COL, DB_ID, databases } from "./db";
import type { Expense } from "./expenses";

export interface Category extends Models.Document {
  hogarId: string;
  name: string;
  color: string;
  icon: string;
  budget: number; // límite mensual en €; 0 = sin límite
}

const teamPerms = (hogarId: string) => [
  Permission.read(Role.team(hogarId)),
  Permission.update(Role.team(hogarId)),
  Permission.delete(Role.team(hogarId)),
];

// Categorías sugeridas al empezar (iconos Ionicons + colores del sistema).
export const DEFAULT_CATEGORIES: { name: string; color: string; icon: string }[] = [
  { name: "Alimentación", color: "#34C759", icon: "cart" },
  { name: "Suministros", color: "#FF9500", icon: "flash" },
  { name: "Hogar", color: "#5AC8FA", icon: "home" },
  { name: "Ocio", color: "#AF52DE", icon: "game-controller" },
  { name: "Transporte", color: "#007AFF", icon: "car" },
  { name: "Otros", color: "#8E8E93", icon: "ellipsis-horizontal" },
];

/**
 * Paleta del editor de categorías, ordenada por tono (verdes → turquesas →
 * azules → morados → rosas → rojos → naranjas → tierra → neutros) para que la
 * cuadrícula se lea como un degradado y no como una bolsa de colores sueltos.
 *
 * Los tonos añadidos van oscurecidos para que el icono blanco de encima se lea
 * (3:1 o más). Los cinco claros que quedan por debajo —#34C759, #5AC8FA,
 * #FF9500, #00C7BE y #E67E22— se quedan a propósito: los cuatro primeros son
 * colores de sistema de Apple que ya usan las categorías por defecto, y es lo
 * que hace iOS en sus iconos de Ajustes. El amarillo puro sí se queda fuera:
 * ahí el blanco directamente no se ve.
 */
export const CATEGORY_COLORS = [
  // Verdes y turquesas
  "#1F8C4D", "#34C759", "#2E7D32", "#5B8C00", "#00796B", "#00C7BE",
  "#1F4D52", "#2A6E75",
  // Azules
  "#5AC8FA", "#0A84FF", "#007AFF", "#0055B8", "#1B3A6B", "#3F7CAC",
  // Morados y rosas
  "#5856D6", "#7D5FFF", "#AF52DE", "#BF5AF2", "#8E44AD", "#C2185B",
  "#FF2D55", "#D81B60",
  // Rojos, naranjas y dorados
  "#FF3B30", "#C0392B", "#E05A2B", "#FF9500", "#E67E22", "#A67C00",
  // Tierra y neutros
  "#A2845E", "#6D4C41", "#5D4037", "#7D6608", "#48484A", "#8E8E93",
];

/**
 * Iconos del editor, agrupados por el tipo de gasto que suele nombrar cada uno:
 * casa y suministros, comida, transporte, salud, ocio, compras, dinero y viajes.
 * Buscar el icono de "gimnasio" o el de "farmacia" tiene que ser mirar donde
 * corresponde, no recorrer una lista suelta.
 */
export const CATEGORY_ICONS = [
  // Casa y suministros
  "home", "bed", "flash", "water", "flame", "wifi",
  "tv", "hammer", "construct", "bulb", "trash", "leaf",
  // Comida
  "cart", "basket", "restaurant", "fast-food", "cafe", "pizza",
  "beer", "wine", "ice-cream", "nutrition",
  // Transporte
  "car", "car-sport", "bus", "train", "subway", "bicycle",
  "airplane", "boat", "walk",
  // Salud y cuidado personal
  "medkit", "bandage", "fitness", "barbell", "heart", "cut",
  // Ocio y cultura
  "game-controller", "musical-notes", "film", "football", "basketball", "tennisball",
  "book", "school", "library", "camera", "headset", "ticket",
  // Compras y servicios
  "shirt", "bag-handle", "storefront", "gift", "paw", "briefcase",
  "phone-portrait", "laptop", "print", "shield",
  // Dinero
  "card", "cash", "wallet", "pricetag", "trending-up", "receipt",
  // Viajes y varios
  "earth", "map", "umbrella", "sunny", "snow", "star",
  "ellipsis-horizontal",
];

export const normalizeName = (name: string): string => name.trim().replace(/\s+/g, " ");

export async function listCategories(hogarId: string): Promise<Category[]> {
  const res = await databases.listDocuments<Category>(DB_ID, CATEGORIES_COL, [
    Query.equal("hogarId", hogarId),
    Query.orderAsc("$createdAt"),
    Query.limit(100),
  ]);
  return res.documents;
}

export async function createCategory(
  hogarId: string,
  data: { name: string; color: string; icon: string; budget?: number },
): Promise<Category> {
  return databases.createDocument<Category>(
    DB_ID,
    CATEGORIES_COL,
    ID.unique(),
    {
      hogarId,
      name: normalizeName(data.name),
      color: data.color,
      icon: data.icon,
      budget: data.budget ?? 0,
    },
    teamPerms(hogarId),
  );
}

export async function updateCategory(
  id: string,
  data: Partial<Pick<Category, "name" | "color" | "icon" | "budget">>,
): Promise<Category> {
  const patch = { ...data };
  if (typeof patch.name === "string") patch.name = normalizeName(patch.name);
  return databases.updateDocument<Category>(DB_ID, CATEGORIES_COL, id, patch);
}

export async function deleteCategory(id: string): Promise<void> {
  await databases.deleteDocument(DB_ID, CATEGORIES_COL, id);
}

/** Crea de una vez las categorías sugeridas (solo si el hogar no tiene ninguna). */
export async function seedDefaultCategories(hogarId: string): Promise<void> {
  const existing = await listCategories(hogarId);
  if (existing.length > 0) return;
  for (const c of DEFAULT_CATEGORIES) {
    await createCategory(hogarId, { ...c, budget: 0 });
  }
}

export function subscribeCategories(onChange: () => void): () => void {
  return client.subscribe(
    `databases.${DB_ID}.collections.${CATEGORIES_COL}.documents`,
    () => onChange(),
  );
}

// --- Interruptor "presupuesto activo" (preferencia compartida del hogar/equipo) ---

export async function getBudgetEnabled(hogarId: string): Promise<boolean> {
  try {
    const prefs = (await teams.getPrefs(hogarId)) as Record<string, unknown>;
    return prefs?.budgetEnabled === true;
  } catch {
    return false;
  }
}

export async function setBudgetEnabled(hogarId: string, on: boolean): Promise<void> {
  let prefs: Record<string, unknown> = {};
  try {
    prefs = (await teams.getPrefs(hogarId)) as Record<string, unknown>;
  } catch {
    /* sin prefs previas */
  }
  await teams.updatePrefs(hogarId, { ...prefs, budgetEnabled: on });
}

// --- Lógica pura (testeable) ---

export type BudgetState = "ok" | "warn" | "over";

export interface CategorySpend {
  $id: string;
  name: string;
  color: string;
  icon: string;
  budget: number;
  spent: number; // gastado este mes en esta categoría
  pct: number; // spent/budget (0 si no hay límite)
  state: BudgetState;
  hasBudget: boolean;
}

function sameMonth(iso: string, now: Date): boolean {
  const d = new Date(iso);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

type ExpenseLike = Pick<Expense, "amount" | "category" | "spentAt" | "$createdAt">;

/** Gasto del mes por categoría, con estado según el % consumido del límite. */
export function budgetStatus(
  categories: Pick<Category, "$id" | "name" | "color" | "icon" | "budget">[],
  expenses: ExpenseLike[],
  now: Date = new Date(),
): CategorySpend[] {
  const monthly = expenses.filter((e) => sameMonth(e.spentAt ?? e.$createdAt, now));
  const spentByName = new Map<string, number>();
  for (const e of monthly) {
    const key = normalizeName(e.category ?? "").toLowerCase();
    if (!key) continue;
    spentByName.set(key, (spentByName.get(key) ?? 0) + e.amount);
  }
  return categories.map((c) => {
    const spent = spentByName.get(normalizeName(c.name).toLowerCase()) ?? 0;
    const hasBudget = c.budget > 0;
    const pct = hasBudget ? spent / c.budget : 0;
    let state: BudgetState = "ok";
    if (hasBudget) state = pct >= 1 ? "over" : pct >= 0.8 ? "warn" : "ok";
    return { $id: c.$id, name: c.name, color: c.color, icon: c.icon, budget: c.budget, spent, pct, state, hasBudget };
  });
}

/** Total presupuestado y total gastado en categorías con límite (este mes). */
export function budgetTotals(rows: CategorySpend[]): { budget: number; spent: number } {
  return rows
    .filter((r) => r.hasBudget)
    .reduce((acc, r) => ({ budget: acc.budget + r.budget, spent: acc.spent + r.spent }), { budget: 0, spent: 0 });
}
