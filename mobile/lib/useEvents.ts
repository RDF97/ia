import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listEvents, subscribeEvents } from "./events";

export function useEvents(hogarId: string | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["events", hogarId],
    queryFn: () => listEvents(hogarId as string),
    enabled: !!hogarId,
  });

  useEffect(() => {
    if (!hogarId) return;
    const unsubscribe = subscribeEvents(() => {
      qc.invalidateQueries({ queryKey: ["events", hogarId] });
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
