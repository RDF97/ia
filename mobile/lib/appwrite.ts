import { Account, Client, Functions, Teams } from "react-native-appwrite";
import Constants from "expo-constants";

// react-native-appwrite, al procesar mensajes de tiempo real, lee
// `window.localStorage` (que no existe en React Native) y lanza un error que
// rompe el auto-refresco. Le damos un almacén en memoria mínimo.
const g = globalThis as unknown as { window?: { localStorage?: unknown } };
if (typeof g.window === "undefined") g.window = {};
if (!g.window.localStorage) {
  const store: Record<string, string> = {};
  g.window.localStorage = {
    getItem: (k: string) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = String(v);
    },
    removeItem: (k: string) => {
      delete store[k];
    },
  };
}

const extra = (Constants.expoConfig?.extra ?? {}) as {
  appwriteEndpoint?: string;
  appwriteProjectId?: string;
};

export const APPWRITE_ENDPOINT = extra.appwriteEndpoint ?? "";
export const APPWRITE_PROJECT_ID = extra.appwriteProjectId ?? "";

// ¿Está configurado el backend? (evita pantallazos si aún no hay endpoint)
export const appwriteConfigured =
  !!APPWRITE_ENDPOINT && !!APPWRITE_PROJECT_ID && !APPWRITE_PROJECT_ID.startsWith("REEMPLAZA");

export const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT || "https://localhost/v1")
  .setProject(APPWRITE_PROJECT_ID || "placeholder")
  .setPlatform("com.homie.app");

export const account = new Account(client);
export const teams = new Teams(client);
export const functions = new Functions(client);
