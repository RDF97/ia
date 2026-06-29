import { ID, Permission, Query, Role, type Models } from "react-native-appwrite";
import { client } from "./appwrite";
import { DB_ID, EXPENSES_COL, databases } from "./db";

export interface Expense extends Models.Document {
  amount: number;
  concept: string;
  category?: string | null;
  paidByName: string;
  shared: boolean;
  hogarId: string;
}

export async function listExpenses(hogarId: string): Promise<Expense[]> {
  const res = await databases.listDocuments<Expense>(DB_ID, EXPENSES_COL, [
    Query.equal("hogarId", hogarId),
    Query.orderDesc("$createdAt"),
    Query.limit(200),
  ]);
  return res.documents;
}

export async function addExpense(
  hogarId: string,
  data: { amount: number; concept: string; paidByName: string; shared: boolean; category?: string },
): Promise<Expense> {
  return databases.createDocument<Expense>(
    DB_ID,
    EXPENSES_COL,
    ID.unique(),
    {
      amount: data.amount,
      concept: data.concept,
      category: data.category || null,
      paidByName: data.paidByName,
      shared: data.shared,
      hogarId,
    },
    [
      Permission.read(Role.team(hogarId)),
      Permission.update(Role.team(hogarId)),
      Permission.delete(Role.team(hogarId)),
    ],
  );
}

export async function deleteExpense(id: string): Promise<void> {
  await databases.deleteDocument(DB_ID, EXPENSES_COL, id);
}

export function subscribeExpenses(onChange: () => void): () => void {
  return client.subscribe(
    `databases.${DB_ID}.collections.${EXPENSES_COL}.documents`,
    () => onChange(),
  );
}

// --- Cálculos ---

export function isThisMonth(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export function monthlyTotal(expenses: Expense[]): number {
  return expenses.filter((e) => isThisMonth(e.$createdAt)).reduce((s, e) => s + e.amount, 0);
}

/**
 * Balance simple del hogar: los gastos "compartidos" se dividen a partes iguales
 * entre `members`. net > 0 → le deben; net < 0 → debe.
 */
export function balances(expenses: Expense[], members: number): { name: string; net: number }[] {
  const shared = expenses.filter((e) => e.shared);
  const totalShared = shared.reduce((s, e) => s + e.amount, 0);
  const share = members > 0 ? totalShared / members : 0;
  const paid: Record<string, number> = {};
  for (const e of shared) paid[e.paidByName] = (paid[e.paidByName] ?? 0) + e.amount;
  return Object.entries(paid).map(([name, p]) => ({ name, net: p - share }));
}
