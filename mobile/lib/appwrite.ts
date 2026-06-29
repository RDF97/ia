import { Account, Client, Teams } from "react-native-appwrite";
import Constants from "expo-constants";

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
