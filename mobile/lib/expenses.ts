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
  spentAt?: string | null; // fecha real del gasto (ISO); ausente → se usa $createdAt
  items?: string | null; // JSON con los artículos del ticket escaneado
  hogarId: string;
}

/** Un artículo del ticket, tal como se guarda dentro del gasto. */
export interface ExpenseItem {
  description: string;
  qty: number | null;
  unitPrice: number | null;
  total: number | null;
}

/** Lee los artículos guardados en un gasto. Nunca lanza: si el JSON está mal, devuelve []. */
export function parseExpenseItems(raw: string | null | undefined): ExpenseItem[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data
      .filter((x) => x && typeof x === "object")
      .map((x) => ({
        description: String(x.description ?? "").trim(),
        qty: typeof x.qty === "number" ? x.qty : null,
        unitPrice: typeof x.unitPrice === "number" ? x.unitPrice : null,
        total: typeof x.total === "number" ? x.total : null,
      }))
      .filter((x) => x.description.length > 0);
  } catch {
    return [];
  }
}

/** Serializa los artículos para guardarlos (null si no hay). */
export function stringifyExpenseItems(items: ExpenseItem[]): string | null {
  return items.length ? JSON.stringify(items) : null;
}

// Gastos antiguos sin cuenta se tratan como individuales (comportamiento previo).
export const effectiveAccount = (e: Pick<Expense, "account">): Account => e.account ?? "individual";

// Fecha efectiva del gasto: la real si existe, si no la de creación (compat).
export const expenseDate = (e: { spentAt?: string | null; $createdAt: string }): string =>
  e.spentAt ?? e.$createdAt;

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
  data: { amount: number; concept: string; paidByName: string; shared: boolean; category?: string; account?: Account; spentAt?: string; items?: string | null },
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
      spentAt: data.spentAt ?? new Date().toISOString(),
      items: data.items ?? null,
      hogarId,
    },
    [
      Permission.read(Role.team(hogarId)),
      Permission.update(Role.team(hogarId)),
      Permission.delete(Role.team(hogarId)),
    ],
  );
}

export async function updateExpense(
  id: string,
  data: {
    amount: number;
    concept: string;
    shared: boolean;
    category?: string | null;
    account?: Account;
    spentAt?: string;
  },
): Promise<Expense> {
  return databases.updateDocument<Expense>(DB_ID, EXPENSES_COL, id, {
    amount: data.amount,
    concept: data.concept,
    category: data.category || null,
    shared: data.shared,
    account: data.account ?? "individual",
    ...(data.spentAt ? { spentAt: data.spentAt } : {}),
  });
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
  return expenses.filter((e) => isThisMonth(expenseDate(e))).reduce((s, e) => s + e.amount, 0);
}

/** Total del mes anterior (para la tendencia "X% vs mes pasado"). */
export function previousMonthTotal(expenses: Expense[], now: Date = new Date()): number {
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return expenses
    .filter((e) => {
      const d = new Date(expenseDate(e));
      return d.getFullYear() === prev.getFullYear() && d.getMonth() === prev.getMonth();
    })
    .reduce((s, e) => s + e.amount, 0);
}

/** Reparto del gasto del mes entre cuenta conjunta e individual. */
export function accountTotals(
  expenses: Pick<Expense, "amount" | "account" | "spentAt" | "$createdAt">[],
  now: Date = new Date(),
): { joint: number; individual: number } {
  let joint = 0;
  let individual = 0;
  for (const e of expenses) {
    const d = new Date(expenseDate(e));
    if (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()) continue;
    if (effectiveAccount(e) === "joint") joint += e.amount;
    else individual += e.amount;
  }
  return { joint, individual };
}

/** Liquidación mínima que necesita `balances` (pago de `fromName` a `toName`). */
export type SettlementLike = { fromName: string; toName: string; amount: number };

/**
 * Balance simple del hogar: solo generan deuda los gastos pagados por una persona
 * de su bolsillo (cuenta individual) y marcados como compartidos; lo pagado desde
 * la cuenta conjunta es dinero común y no reparte. net > 0 → le deben; net < 0 → debe.
 *
 * Las liquidaciones saldan deuda sin ser gasto: quien paga (`fromName`) sube su
 * balance hacia 0 y quien cobra (`toName`) baja el suyo, por el mismo importe.
 */
export function balances(
  expenses: Expense[],
  members: number,
  settlements: SettlementLike[] = [],
): { name: string; net: number }[] {
  const shared = expenses.filter((e) => e.shared && effectiveAccount(e) === "individual");
  const totalShared = shared.reduce((s, e) => s + e.amount, 0);
  const share = members > 0 ? totalShared / members : 0;
  const paid: Record<string, number> = {};
  for (const e of shared) paid[e.paidByName] = (paid[e.paidByName] ?? 0) + e.amount;
  for (const s of settlements) {
    paid[s.fromName] = (paid[s.fromName] ?? 0) + s.amount;
    paid[s.toName] = (paid[s.toName] ?? 0) - s.amount;
  }
  // Descarta balances ya saldados (redondeo a céntimo).
  return Object.entries(paid)
    .map(([name, p]) => ({ name, net: p - share }))
    .filter((b) => Math.abs(b.net) >= 0.005);
}
