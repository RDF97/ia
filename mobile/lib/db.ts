import { Databases } from "react-native-appwrite";
import Constants from "expo-constants";
import { client } from "./appwrite";

const extra = (Constants.expoConfig?.extra ?? {}) as {
  appwriteDatabaseId?: string;
  appwriteTasksCollectionId?: string;
};

export const DB_ID = extra.appwriteDatabaseId ?? "homie";
export const TASKS_COL = extra.appwriteTasksCollectionId ?? "tasks";

export const databases = new Databases(client);
