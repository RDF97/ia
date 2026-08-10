import type { Expense } from "./expenses";

/** Lo que dice el aviso de un gasto recién apuntado. */
export function expenseAlertText(e: Pick<Expense, "amount" | "concept" | "paidByName">): {
  title: string;
  body: string;
} {
  const amount = `${e.amount.toFixed(2).replace(".", ",")} €`;
  return { title: `💶 ${e.paidByName} ha apuntado un gasto`, body: `${e.concept} · ${amount}` };
}

/** ¿Hay que avisar de este gasto? No, si es de otro hogar o lo apunté yo. */
export function shouldAlert(
  e: Pick<Expense, "hogarId" | "paidByName">,
  hogarId: string,
  myName: string,
): boolean {
  if (e.hogarId !== hogarId) return false;
  return e.paidByName.trim().toLowerCase() !== myName.trim().toLowerCase();
}
