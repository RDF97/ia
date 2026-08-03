import { useQuery } from "@tanstack/react-query";
import { listMembers } from "./members";

/** Miembros del hogar (nombres para asignar tareas y repartir gastos). */
export function useMembers(hogarId: string | undefined) {
  return useQuery({
    queryKey: ["members", hogarId],
    queryFn: () => listMembers(hogarId as string),
    enabled: !!hogarId,
    staleTime: 5 * 60_000,
  });
}
