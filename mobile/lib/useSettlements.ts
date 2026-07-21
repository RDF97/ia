import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listSettlements, subscribeSettlements } from "./settlements";

// Liquidaciones del hogar, sincronizadas en tiempo real.
export function useSettlements(hogarId: string | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["settlements", hogarId],
    queryFn: () => listSettlements(hogarId as string),
    enabled: !!hogarId,
  });

  useEffect(() => {
    if (!hogarId) return;
    const unsubscribe = subscribeSettlements(() => {
      qc.invalidateQueries({ queryKey: ["settlements", hogarId] });
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
