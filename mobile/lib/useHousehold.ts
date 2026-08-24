import { useMemo } from "react";
import { useMembers } from "./useMembers";
import { useExpenses } from "./useExpenses";
import { useTasks } from "./useTasks";
import { useEvents } from "./useEvents";
import { householdRoster } from "./roster";

/**
 * Los nombres de las personas del hogar, sacados de todas las fuentes a la vez.
 *
 * Las cuatro consultas ya están cacheadas por react-query en cualquier pantalla
 * que las use, así que esto no añade tráfico salvo la primera vez que se abre
 * una pestaña que no las tenía.
 */
export function useHouseholdNames(hogarId: string | undefined, myName: string): string[] {
  const members = useMembers(hogarId).data;
  const expenses = useExpenses(hogarId).data;
  const tasks = useTasks(hogarId).data;
  const events = useEvents(hogarId).data;

  return useMemo(
    () =>
      householdRoster(myName, {
        members: (members ?? []).map((m) => m.name),
        expenses,
        tasks,
        events,
      }),
    [members, expenses, tasks, events, myName],
  );
}
