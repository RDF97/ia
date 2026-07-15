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

// Paletas para el editor.
export const CATEGORY_COLORS = [
  "#34C759", "#30D158", "#5AC8FA", "#007AFF", "#5856D6", "#AF52DE",
  "#FF2D55", "#FF3B30", "#FF9500", "#FFCC00", "#8E8E93", "#1F4D52",
];
export const CATEGORY_ICONS = [
  "cart", "flash", "home", "game-controller", "car", "restaurant",
  "medkit", "gift", "paw", "fitness", "airplane", "school",
  "shirt", "cafe", "wifi", "ellipsis-horizontal",
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
