import { useQuery } from "@tanstack/react-query";
import { fetchLuzPrices } from "./luzData";

// Carga los precios PVPC (REE → preciodelaluz → ejemplo) y los cachea 30 min.
export function useLuzPrices() {
  return useQuery({
    queryKey: ["luz-prices"],
    queryFn: fetchLuzPrices,
    staleTime: 1000 * 60 * 30,
  });
}
