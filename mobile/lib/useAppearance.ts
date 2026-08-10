import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getHogarIcon, getPerfilIcon, type IconStyle } from "./appearance";

/**
 * Iconos personalizados del hogar y del perfil, cacheados con react-query.
 *
 * Antes cada pantalla los leía por su cuenta con un `useEffect`: al cambiar el
 * icono en Perfil, Inicio seguía enseñando el de antes hasta reiniciar la app.
 * Con una caché compartida basta con invalidarla al guardar (`refreshAppearance`)
 * y se actualiza en todas partes a la vez.
 */
export function useHogarIcon(hogarId: string | undefined, fallbackColor: string) {
  return useQuery<IconStyle>({
    queryKey: ["hogar-icon", hogarId],
    queryFn: () => getHogarIcon(hogarId as string, fallbackColor),
    enabled: !!hogarId,
    staleTime: 60_000,
  });
}

export function usePerfilIcon(fallbackColor: string) {
  return useQuery<IconStyle | null>({
    queryKey: ["perfil-icon"],
    queryFn: () => getPerfilIcon(fallbackColor),
    staleTime: 60_000,
  });
}

export function useRefreshAppearance(): () => Promise<void> {
  const qc = useQueryClient();
  return async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["hogar-icon"] }),
      qc.invalidateQueries({ queryKey: ["perfil-icon"] }),
    ]);
  };
}
