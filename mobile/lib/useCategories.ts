import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listCategories, subscribeCategories } from "./categories";

export function useCategories(hogarId: string | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["categories", hogarId],
    queryFn: () => listCategories(hogarId as string),
    enabled: !!hogarId,
  });

  useEffect(() => {
    if (!hogarId) return;
    const unsubscribe = subscribeCategories(() => {
      qc.invalidateQueries({ queryKey: ["categories", hogarId] });
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
