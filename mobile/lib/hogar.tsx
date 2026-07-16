import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ID, type Models } from "react-native-appwrite";
import { teams } from "./appwrite";
import { useAuth } from "./auth";

export type Hogar = Models.Team<Models.Preferences>;

interface HogarContextValue {
  hogares: Hogar[];
  active: Hogar | null;
  loading: boolean;
  reload: () => Promise<void>;
  createHogar: (name: string) => Promise<Hogar>;
  leaveHogar: () => Promise<void>;
}

const HogarContext = createContext<HogarContextValue | undefined>(undefined);

export function HogarProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [hogares, setHogares] = useState<Hogar[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!user) {
      setHogares([]);
      setLoading(false);
      return;
    }
    try {
      const res = await teams.list();
      setHogares(res.teams);
    } catch {
      setHogares([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    setLoading(true);
    reload();
  }, [reload]);

  const createHogar = useCallback(
    async (name: string) => {
      const hogar = await teams.create(ID.unique(), name);
      await reload();
      return hogar;
    },
    [reload],
  );

  // Salir del hogar: si eres el único miembro se elimina el hogar entero;
  // si hay más, se borra solo tu membresía.
  const leaveHogar = useCallback(async () => {
    const h = hogares[0];
    if (!h || !user) return;
    if (h.total <= 1) {
      await teams.delete(h.$id);
    } else {
      const ms = await teams.listMemberships(h.$id);
      const own = ms.memberships.find((m) => m.userId === user.$id);
      if (!own) throw new Error("No se encontró tu membresía en el hogar");
      await teams.deleteMembership(h.$id, own.$id);
    }
    await reload();
  }, [hogares, user, reload]);

  const value = useMemo<HogarContextValue>(
    () => ({ hogares, active: hogares[0] ?? null, loading, reload, createHogar, leaveHogar }),
    [hogares, loading, reload, createHogar, leaveHogar],
  );

  return <HogarContext.Provider value={value}>{children}</HogarContext.Provider>;
}

export function useHogar() {
  const ctx = useContext(HogarContext);
  if (!ctx) throw new Error("useHogar debe usarse dentro de <HogarProvider>");
  return ctx;
}
