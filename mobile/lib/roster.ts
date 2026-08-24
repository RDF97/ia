/**
 * Quién vive en este hogar, según TODO lo que sabemos.
 *
 * El nombre de una persona puede venir de cuatro sitios distintos, y ninguno es
 * fiable por sí solo:
 *
 *  1. La membresía de Appwrite — casi siempre vacía: `teams.listMemberships` no
 *     expone `userName` ni `userEmail` a la propia app.
 *  2. Su ficha en `profiles` — solo existe si esa persona ha abierto una versión
 *     de la app que las publique. Si tiene el móvil con una build vieja, no hay.
 *  3. Los gastos que ha apuntado (`paidByName`, `forName`).
 *  4. Las tareas que tiene asignadas y los eventos que ha creado.
 *
 * Antes solo se miraban los dos primeros, así que alguien que llevaba meses
 * apuntando gastos —con su nombre escrito en cada uno de ellos— seguía saliendo
 * como "Miembro sin nombre" y no se le podía asignar nada. Es absurdo tener el
 * nombre delante y no usarlo.
 *
 * Aquí se juntan los cuatro. Basta con que UNO tenga el nombre.
 */

export interface NameSources {
  /** Nombres de las membresías y las fichas (lo de `useMembers`). */
  members?: string[];
  expenses?: { paidByName?: string | null; forName?: string | null }[];
  tasks?: { assignedToName?: string | null }[];
  events?: { ownerName?: string | null }[];
}

/** Compara ignorando mayúsculas y espacios, que es como los escribe la gente. */
const clave = (s: string) => s.trim().toLowerCase();

/**
 * Lista de nombres del hogar, sin repetir y con `mine` siempre el primero.
 *
 * El orden importa: en el selector de "quién paga" y en el de "para quién es",
 * lo primero es lo que se elige sin pensar, y casi siempre eres tú.
 */
export function householdRoster(mine: string, src: NameSources): string[] {
  const vistos = new Map<string, string>();
  const añadir = (n: string | null | undefined) => {
    const limpio = (n ?? "").trim();
    if (!limpio) return;
    // Se guarda la PRIMERA forma vista de cada nombre: si en un gasto se escribió
    // "clara" y en la ficha "Clara", mandan las fuentes de más arriba.
    if (!vistos.has(clave(limpio))) vistos.set(clave(limpio), limpio);
  };

  añadir(mine);
  for (const n of src.members ?? []) añadir(n);
  for (const e of src.expenses ?? []) {
    añadir(e.paidByName);
    añadir(e.forName);
  }
  for (const t of src.tasks ?? []) añadir(t.assignedToName);
  for (const e of src.events ?? []) añadir(e.ownerName);

  return [...vistos.values()];
}
