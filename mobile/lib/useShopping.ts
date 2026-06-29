import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listShopping, subscribeShopping } from "./shopping";

// Lista de la compra del hogar, sincronizada en tiempo real.
export function useShopping(hogarId: string | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["shopping", hogarId],
    queryFn: () => listShopping(hogarId as string),
    enabled: !!hogarId,
  });

  useEffect(() => {
    if (!hogarId) return;
    const unsubscribe = subscribeShopping(() => {
      qc.invalidateQueries({ queryKey: ["shopping", hogarId] });
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
