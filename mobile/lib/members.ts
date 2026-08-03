import { teams } from "./appwrite";

export interface Member {
  id: string; // id de la membresía
  userId: string;
  name: string;
  email: string;
  roles: string[];
  joinedAt: string;
  confirmed: boolean;
}

/** Miembros del hogar (para saber quién más está dentro). */
export async function listMembers(hogarId: string): Promise<Member[]> {
  const res = await teams.listMemberships(hogarId);
  return res.memberships.map((m) => ({
    id: m.$id,
    userId: m.userId,
    name: (m.userName || "").trim() || (m.userEmail || "").split("@")[0] || "Sin nombre",
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
