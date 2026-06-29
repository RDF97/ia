import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listExpenses, subscribeExpenses } from "./expenses";

export function useExpenses(hogarId: string | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["expenses", hogarId],
    queryFn: () => listExpenses(hogarId as string),
    enabled: !!hogarId,
  });

  useEffect(() => {
    if (!hogarId) return;
    const unsubscribe = subscribeExpenses(() => {
      qc.invalidateQueries({ queryKey: ["expenses", hogarId] });
    });
    return () => {
      try {
        unsubscribe();
      } catch {
        /* noop */
      }
    };
  }, [hogarId, qc]);

  return query;
}
