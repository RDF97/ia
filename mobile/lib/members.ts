import { teams } from "./appwrite";

export interface Member {
  id: string; // id de la membresía
  userId: string;
  /**
   * Nombre real de la persona, o "" si no se sabe.
   *
   * OJO: aquí NO se inventa un "Sin nombre". Ese texto acababa colándose en el
   * reparto de gastos como si fuera una persona más, y aparecía un fantasma
   * debiendo dinero sin ningún gasto detrás (se llevaba su parte de todos los
   * gastos compartidos). Quien no tiene nombre no participa en el dinero.
   */
  name: string;
  email: string;
  roles: string[];
  joinedAt: string;
  confirmed: boolean;
}

/** Cómo llamar a alguien en la interfaz cuando no se le conoce el nombre. */
export const memberLabel = (m: Pick<Member, "name" | "email">): string =>
  m.name || m.email || "Miembro sin nombre";

/**
 * Personas que cuentan para repartir dinero: las que están confirmadas y de las
 * que sabemos el nombre. Una invitación pendiente todavía no es nadie, y a quien
 * no podemos nombrar tampoco podemos cobrarle.
 */
export const payingMembers = (members: Member[]): string[] =>
  [...new Set(members.filter((m) => m.confirmed && m.name).map((m) => m.name))];

/** Miembros del hogar (para saber quién más está dentro). */
export async function listMembers(hogarId: string): Promise<Member[]> {
  const res = await teams.listMemberships(hogarId);
  return res.memberships.map((m) => ({
    id: m.$id,
    userId: m.userId,
    name: (m.userName || "").trim() || (m.userEmail || "").split("@")[0] || "",
    email: m.userEmail || "",
    roles: m.roles ?? [],
    joinedAt: m.$createdAt,
    confirmed: m.confirm ?? true,
  }));
}

/** Quita a alguien del hogar (solo si tienes permiso de propietario). */
export async function removeMember(hogarId: string, membershipId: string): Promise<void> {
  await teams.deleteMembership(hogarId, membershipId);
}
