import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import * as Linking from "expo-linking";
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
  invite: (email: string) => Promise<void>;
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

  // Invita por email: la persona recibe un enlace para unirse al hogar.
  const invite = useCallback(
    async (email: string) => {
      const active = hogares[0];
      if (!active) throw new Error("No hay un hogar activo");
      const redirect = Linking.createURL("/join");
      await teams.createMembership(active.$id, ["member"], email, undefined, undefined, redirect);
    },
    [hogares],
  );

  const value = useMemo<HogarContextValue>(
    () => ({ hogares, active: hogares[0] ?? null, loading, reload, createHogar, invite }),
    [hogares, loading, reload, createHogar, invite],
  );

  return <HogarContext.Provider value={value}>{children}</HogarContext.Provider>;
}

export function useHogar() {
  const ctx = useContext(HogarContext);
  if (!ctx) throw new Error("useHogar debe usarse dentro de <HogarProvider>");
  return ctx;
}
