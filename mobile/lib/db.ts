import { Databases } from "react-native-appwrite";
import Constants from "expo-constants";
import { client } from "./appwrite";

const extra = (Constants.expoConfig?.extra ?? {}) as {
  appwriteDatabaseId?: string;
  appwriteTasksCollectionId?: string;
  appwriteShoppingCollectionId?: string;
  appwriteExpensesCollectionId?: string;
};

export const DB_ID = extra.appwriteDatabaseId ?? "homie";
export const TASKS_COL = extra.appwriteTasksCollectionId ?? "tasks";
export const SHOPPING_COL = extra.appwriteShoppingCollectionId ?? "shopping_items";
export const EXPENSES_COL = extra.appwriteExpensesCollectionId ?? "expenses";

export const databases = new Databases(client);
