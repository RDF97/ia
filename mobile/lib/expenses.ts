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
  splits?: string | null; // JSON con el reparto por porcentajes (si no, a partes iguales)
  /**
   * De quién es el gasto, cuando es individual y NO compartido. Se separa de
   * `paidByName` (quien puso el dinero) a propósito: Clara puede apuntar un
   * gasto que pagó ella pero que es de Rubén, y entonces Rubén se lo debe.
   * Ausente → es de quien lo pagó (comportamiento de siempre, sin deuda).
   */
  forName?: string | null;
  hogarId: string;
}

/** De quién es el gasto: el titular si está puesto, si no quien lo pagó. */
export const expenseOwner = (e: Pick<Expense, "forName" | "paidByName">): string =>
  (e.forName ?? "").trim() || e.paidByName;

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

/** Reparto de un gasto: qué porcentaje le toca a cada persona. */
export interface ExpenseSplit {
  name: string;
  pct: number; // 0-100
}

/** Lee el reparto guardado. Nunca lanza; si no cuadra a 100 %, se descarta. */
export function parseSplits(raw: string | null | undefined): ExpenseSplit[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    const out = data
      .filter((x) => x && typeof x === "object" && typeof x.name === "string")
      .map((x) => ({ name: String(x.name).trim(), pct: Number(x.pct) }))
      .filter((x) => x.name.length > 0 && isFinite(x.pct) && x.pct >= 0);
    if (!out.length) return [];
    // Un reparto que no suma 100 sería un reparto mal hecho: mejor ignorarlo y
    // repartir a partes iguales que descuadrar las cuentas en silencio.
    const total = out.reduce((s, x) => s + x.pct, 0);
    return Math.abs(total - 100) < 0.01 ? out : [];
  } catch {
    return [];
  }
}

export function stringifySplits(splits: ExpenseSplit[]): string | null {
  return splits.length ? JSON.stringify(splits) : null;
}

/** Reparto a partes iguales entre los miembros (el de por defecto). */
export function equalSplits(names: string[]): ExpenseSplit[] {
  if (!names.length) return [];
  const pct = Math.round((100 / names.length) * 100) / 100;
  const out = names.map((name) => ({ name, pct }));
  // El redondeo se corrige en el último para que sume exactamente 100.
  const diff = 100 - out.reduce((s, x) => s + x.pct, 0);
  out[out.length - 1].pct = Math.round((out[out.length - 1].pct + diff) * 100) / 100;
  return out;
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

/**
 * Campos que puede que la colección todavía no tenga (se añaden con
 * `scripts/appwrite-setup.sh`). Appwrite RECHAZA el documento entero si mandas
 * un atributo inexistente, así que se intenta con ellos y, si falla, se guarda
 * sin ellos: mejor un gasto sin detalle que ningún gasto.
 */
const OPTIONAL_FIELDS = ["items", "splits", "forName"] as const;

const pickOptional = (data: Record<string, unknown>): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const k of OPTIONAL_FIELDS) {
    const v = data[k];
    if (typeof v === "string" && v) out[k] = v;
  }
  return out;
};

export async function addExpense(
  hogarId: string,
  data: {
    amount: number;
    concept: string;
    paidByName: string;
    shared: boolean;
    category?: string;
    account?: Account;
    spentAt?: string;
    items?: string | null;
    splits?: string | null;
    forName?: string | null;
  },
): Promise<Expense> {
  const base = {
    amount: data.amount,
    concept: data.concept,
    category: data.category || null,
    paidByName: data.paidByName,
    shared: data.shared,
    account: data.account ?? "individual",
    spentAt: data.spentAt ?? new Date().toISOString(),
    hogarId,
  };
  const perms = [
    Permission.read(Role.team(hogarId)),
    Permission.update(Role.team(hogarId)),
    Permission.delete(Role.team(hogarId)),
  ];

  const extra = pickOptional(data as Record<string, unknown>);
  if (Object.keys(extra).length) {
    try {
      return await databases.createDocument<Expense>(
        DB_ID,
        EXPENSES_COL,
        ID.unique(),
        { ...base, ...extra },
        perms,
      );
    } catch {
      /* seguimos sin los campos opcionales */
    }
  }
  return databases.createDocument<Expense>(DB_ID, EXPENSES_COL, ID.unique(), base, perms);
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
    splits?: string | null;
    paidByName?: string;
    forName?: string | null;
  },
): Promise<Expense> {
  const base = {
    amount: data.amount,
    concept: data.concept,
    category: data.category || null,
    shared: data.shared,
    account: data.account ?? "individual",
    ...(data.spentAt ? { spentAt: data.spentAt } : {}),
    ...(data.paidByName ? { paidByName: data.paidByName } : {}),
  };
  // `splits` y `forName` se mandan siempre que se toquen (también en null, para
  // poder borrarlos); si la colección aún no los tiene, se guarda el resto.
  const optional: Record<string, string | null> = {};
  if (data.splits !== undefined) optional.splits = data.splits;
  if (data.forName !== undefined) optional.forName = data.forName;
  if (Object.keys(optional).length) {
    try {
      return await databases.updateDocument<Expense>(DB_ID, EXPENSES_COL, id, { ...base, ...optional });
    } catch {
      /* los atributos opcionales aún no existen: guardamos el resto */
    }
  }
  return databases.updateDocument<Expense>(DB_ID, EXPENSES_COL, id, base);
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

type OwnedExpense = Pick<Expense, "amount" | "account" | "shared" | "paidByName" | "forName" | "splits">;

/**
 * Gasto individual de cada persona: lo que le corresponde a ella y no al hogar.
 *
 * Se atribuye a su titular, no a quien puso el dinero: si Clara paga el gimnasio
 * de Rubén, el gasto es de Rubén (y además se lo debe). Los compartidos se
 * reparten según su porcentaje, o a partes iguales.
 */
export function individualByPerson(
  expenses: OwnedExpense[],
  memberNames: string[] = [],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const n of memberNames) if (n.trim()) out[n] = 0;
  const add = (name: string, v: number) => {
    out[name] = (out[name] ?? 0) + v;
  };

  for (const e of expenses) {
    if (effectiveAccount(e) !== "individual") continue;
    if (!e.shared) {
      add(expenseOwner(e), e.amount);
      continue;
    }
    const splits = parseSplits(e.splits);
    if (splits.length) {
      for (const sp of splits) add(sp.name, (e.amount * sp.pct) / 100);
    } else {
      const people = memberNames.filter((n) => n.trim());
      const n = people.length || 1;
      for (const p of people.length ? people : [e.paidByName]) add(p, e.amount / n);
    }
  }
  return out;
}

/** Liquidación mínima que necesita `balances` (pago de `fromName` a `toName`). */
export type SettlementLike = { fromName: string; toName: string; amount: number };

/**
 * Balance simple del hogar. Lo pagado desde la cuenta conjunta es dinero común y
 * no reparte; solo generan deuda los gastos de bolsillo (cuenta individual):
 *
 *  · compartidos → se reparten entre el hogar (por porcentaje o a partes iguales);
 *  · no compartidos → son de su titular (`forName`), y si lo pagó otra persona,
 *    el titular se lo debe entero.
 *
 * net > 0 → le deben; net < 0 → debe. Las liquidaciones saldan deuda sin ser
 * gasto: quien paga (`fromName`) sube su balance hacia 0 y quien cobra (`toName`)
 * baja el suyo, por el mismo importe.
 */
export function balances(
  expenses: Expense[],
  members: number,
  settlements: SettlementLike[] = [],
  memberNames: string[] = [],
): { name: string; net: number }[] {
  const own = expenses.filter((e) => effectiveAccount(e) === "individual");
  const shared = own.filter((e) => e.shared);
  // Gasto personal de alguien que pagó otro: deuda directa por el total.
  const personal = own.filter((e) => !e.shared && expenseOwner(e) !== e.paidByName);

  // Quién participa: los miembros del hogar y, por si acaso, quien haya pagado
  // o aparezca en algún reparto (p. ej. alguien que ya se fue del hogar).
  const people = new Set<string>();
  for (const n of memberNames) if (n.trim()) people.add(n);
  for (const e of shared) {
    people.add(e.paidByName);
    for (const sp of parseSplits(e.splits)) people.add(sp.name);
  }
  for (const e of personal) {
    people.add(e.paidByName);
    people.add(expenseOwner(e));
  }

  const paid: Record<string, number> = {};
  const owed: Record<string, number> = {};
  for (const n of people) {
    paid[n] = 0;
    owed[n] = 0;
  }

  for (const e of shared) {
    paid[e.paidByName] = (paid[e.paidByName] ?? 0) + e.amount;
    const splits = parseSplits(e.splits);
    if (splits.length) {
      // Reparto explícito (p. ej. 20 % / 80 %).
      for (const sp of splits) owed[sp.name] = (owed[sp.name] ?? 0) + (e.amount * sp.pct) / 100;
    } else {
      // Sin reparto: a partes iguales entre los miembros del hogar.
      const n = members > 0 ? members : people.size;
      const part = n > 0 ? e.amount / n : 0;
      for (const p of people) owed[p] = (owed[p] ?? 0) + part;
    }
  }

  for (const e of personal) {
    paid[e.paidByName] = (paid[e.paidByName] ?? 0) + e.amount;
    owed[expenseOwner(e)] = (owed[expenseOwner(e)] ?? 0) + e.amount;
  }

  // Las liquidaciones saldan deuda: quien paga sube y quien cobra baja.
  for (const s of settlements) {
    paid[s.fromName] = (paid[s.fromName] ?? 0) + s.amount;
    paid[s.toName] = (paid[s.toName] ?? 0) - s.amount;
  }

  return Object.keys(paid)
    .map((name) => ({ name, net: (paid[name] ?? 0) - (owed[name] ?? 0) }))
    .filter((b) => Math.abs(b.net) >= 0.005);
}

/** Una línea del desglose de una deuda: de dónde sale cada euro. */
export interface BalanceLine {
  id: string;
  concept: string;
  date: string;
  /** Lo que puso esa persona. */
  paid: number;
  /** Lo que le tocaba. */
  owed: number;
  /** paid − owed: cuánto mueve su balance esta línea. */
  delta: number;
  kind: "expense" | "settlement";
}

/**
 * De qué gastos sale el balance de una persona, línea a línea.
 *
 * Existe porque un número suelto ("te debe 37,40 €") no se puede comprobar: si
 * no cuadra, no hay forma de saber qué gasto mirar. La suma de los `delta` es
 * exactamente el `net` que devuelve `balances`.
 */
export function balanceDetail(
  expenses: Expense[],
  name: string,
  members: number,
  settlements: SettlementLike[] = [],
  memberNames: string[] = [],
): { lines: BalanceLine[]; net: number } {
  const own = expenses.filter((e) => effectiveAccount(e) === "individual");
  const people = new Set<string>();
  for (const n of memberNames) if (n.trim()) people.add(n);
  for (const e of own) {
    people.add(e.paidByName);
    people.add(expenseOwner(e));
    for (const sp of parseSplits(e.splits)) people.add(sp.name);
  }

  const lines: BalanceLine[] = [];
  for (const e of own) {
    const paid = e.paidByName === name ? e.amount : 0;
    let owed = 0;
    if (e.shared) {
      const splits = parseSplits(e.splits);
      if (splits.length) {
        owed = splits.filter((sp) => sp.name === name).reduce((s, sp) => s + (e.amount * sp.pct) / 100, 0);
      } else if (people.has(name)) {
        const n = members > 0 ? members : people.size;
        owed = n > 0 ? e.amount / n : 0;
      }
    } else if (expenseOwner(e) !== e.paidByName) {
      owed = expenseOwner(e) === name ? e.amount : 0;
    }
    if (Math.abs(paid) < 0.005 && Math.abs(owed) < 0.005) continue;
    lines.push({
      id: e.$id,
      concept: e.concept,
      date: expenseDate(e),
      paid,
      owed,
      delta: paid - owed,
      kind: "expense",
    });
  }

  // Las liquidaciones no son gasto, pero mueven el balance: sin ellas el
  // desglose no sumaría lo mismo que el total.
  settlements.forEach((s, i) => {
    const delta = s.fromName === name ? s.amount : s.toName === name ? -s.amount : 0;
    if (Math.abs(delta) < 0.005) return;
    lines.push({
      id: `settlement-${i}`,
      concept: delta > 0 ? `Pagaste a ${s.toName}` : `${s.fromName} te pagó`,
      date: "",
      paid: delta > 0 ? s.amount : 0,
      owed: delta < 0 ? s.amount : 0,
      delta,
      kind: "settlement",
    });
  });

  lines.sort((a, b) => b.date.localeCompare(a.date));
  return { lines, net: lines.reduce((s, l) => s + l.delta, 0) };
}
