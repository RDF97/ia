import type { BankMovement } from "./csv";

export interface ReconMovement extends BankMovement {
  matchedId: string | null; // id del gasto ya registrado que le corresponde, o null
  income: boolean; // true si es un abono (importe positivo): no se concilia como gasto
}

type ExpenseRef = { $id: string; amount: number; $createdAt: string };

const DAY = 86400000;

/**
 * Casa cada movimiento (cargo) del banco con un gasto ya registrado por importe
 * (±0,5 cént.) y fecha cercana (±toleranceDays). Cada gasto se usa una sola vez.
 * Los abonos (importe positivo) se marcan como ingreso y no se concilian.
 */
export function reconcile(
  movements: BankMovement[],
  expenses: ExpenseRef[],
  toleranceDays = 3,
): ReconMovement[] {
  const used = new Set<string>();
  return movements.map((mv) => {
    if (mv.amount >= 0) return { ...mv, matchedId: null, income: true };
    const target = Math.abs(mv.amount);
    const mvTime = new Date(mv.date).getTime();
    let best: { id: string; diff: number } | null = null;
    for (const e of expenses) {
      if (used.has(e.$id)) continue;
      if (Math.abs(e.amount - target) > 0.005) continue;
      const diff = Math.abs(new Date(e.$createdAt).getTime() - mvTime);
      if (diff <= toleranceDays * DAY && (best === null || diff < best.diff)) best = { id: e.$id, diff };
    }
    if (best) {
      used.add(best.id);
      return { ...mv, matchedId: best.id, income: false };
    }
    return { ...mv, matchedId: null, income: false };
  });
}

export interface ReconSummary {
  charges: number; // nº de cargos
  matched: number; // ya registrados
  missing: number; // faltan por registrar
  income: number; // nº de abonos (ignorados)
}

export function reconSummary(rows: ReconMovement[]): ReconSummary {
  let matched = 0;
  let missing = 0;
  let income = 0;
  for (const r of rows) {
    if (r.income) income++;
    else if (r.matchedId) matched++;
    else missing++;
  }
  return { charges: matched + missing, matched, missing, income };
}
