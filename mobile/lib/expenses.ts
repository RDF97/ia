import { ID, Permission, Query, Role, type Models } from "react-native-appwrite";
import { client } from "./appwrite";
import { DB_ID, EXPENSES_COL, databases } from "./db";

export type Account = "joint" | "individual";

export interface Expense extends Models.Document {
  amount: number;
  concept: string;
  category?: string | null;
  paidByName: string;
  shared: boolean;
  account?: Account | null; // "joint" = cuenta conjunta; ausente = individual (compat)
  hogarId: string;
}

// Gastos antiguos sin cuenta se tratan como individuales (comportamiento previo).
export const effectiveAccount = (e: Pick<Expense, "account">): Account => e.account ?? "individual";

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
  data: { amount: number; concept: string; paidByName: string; shared: boolean; category?: string; account?: Account },
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
      account: data.account ?? "individual",
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

/** Reparto del gasto del mes entre cuenta conjunta e individual. */
export function accountTotals(
  expenses: Pick<Expense, "amount" | "account" | "$createdAt">[],
  now: Date = new Date(),
): { joint: number; individual: number } {
  let joint = 0;
  let individual = 0;
  for (const e of expenses) {
    const d = new Date(e.$createdAt);
    if (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()) continue;
    if (effectiveAccount(e) === "joint") joint += e.amount;
    else individual += e.amount;
  }
  return { joint, individual };
}

/**
 * Balance simple del hogar: solo generan deuda los gastos pagados por una persona
 * de su bolsillo (cuenta individual) y marcados como compartidos; lo pagado desde
 * la cuenta conjunta es dinero común y no reparte. net > 0 → le deben; net < 0 → debe.
 */
export function balances(expenses: Expense[], members: number): { name: string; net: number }[] {
  const shared = expenses.filter((e) => e.shared && effectiveAccount(e) === "individual");
  const totalShared = shared.reduce((s, e) => s + e.amount, 0);
  const share = members > 0 ? totalShared / members : 0;
  const paid: Record<string, number> = {};
  for (const e of shared) paid[e.paidByName] = (paid[e.paidByName] ?? 0) + e.amount;
  return Object.entries(paid).map(([name, p]) => ({ name, net: p - share }));
}
