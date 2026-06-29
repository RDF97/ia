import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listTasks, subscribeTasks } from "./tasks";

// Carga las tareas del hogar y se mantiene al día en tiempo real.
export function useTasks(hogarId: string | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["tasks", hogarId],
    queryFn: () => listTasks(hogarId as string),
    enabled: !!hogarId,
  });

  useEffect(() => {
    if (!hogarId) return;
    const unsubscribe = subscribeTasks(() => {
      qc.invalidateQueries({ queryKey: ["tasks", hogarId] });
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
