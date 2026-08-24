/**
 * Cuál de los hogares es "el mío" cuando hay más de uno.
 *
 * Antes se cogía `hogares[0]`, o sea el primero que devolviera Appwrite. Con dos
 * hogares del mismo nombre —uno de verdad y otro que quedó de una prueba— eso es
 * una lotería: cada móvil podía acabar mirando uno distinto, las fichas estaban
 * en uno solo, y todo el mundo salía como "Miembro sin nombre" sin que nada
 * apuntara al hogar equivocado.
 *
 * Manda el que tiene más gente: un hogar de una sola persona nunca es el que
 * buscas cuando lo compartes con alguien. A igualdad, el más antiguo, que es el
 * que lleva la historia detrás. El orden no depende de lo que devuelva el
 * servidor, así que los dos móviles eligen siempre el mismo.
 */
export function pickHogar<T extends { $id: string; total: number; $createdAt: string }>(
  hogares: T[],
): T | null {
  if (!hogares.length) return null;
  return [...hogares].sort(
    (a, b) =>
      b.total - a.total ||
      a.$createdAt.localeCompare(b.$createdAt) ||
      a.$id.localeCompare(b.$id),
  )[0];
}
