import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listIncomes } from "./incomes";

/** Ingreso mensual de cada miembro del hogar, por nombre. */
export function useIncomes(hogarId: string | undefined, myName: string) {
  return useQuery<Record<string, number>>({
    queryKey: ["incomes", hogarId],
    queryFn: () => listIncomes(hogarId as string, myName),
    enabled: !!hogarId,
    staleTime: 60_000,
  });
}

export function useRefreshIncomes(hogarId: string | undefined): () => Promise<void> {
  const qc = useQueryClient();
  return async () => {
    await qc.invalidateQueries({ queryKey: ["incomes", hogarId] });
  };
}
