import { Databases } from "react-native-appwrite";
import Constants from "expo-constants";
import { client } from "./appwrite";

const extra = (Constants.expoConfig?.extra ?? {}) as {
  appwriteDatabaseId?: string;
  appwriteTasksCollectionId?: string;
  appwriteShoppingCollectionId?: string;
  appwriteExpensesCollectionId?: string;
  appwriteEventsCollectionId?: string;
  appwriteProductsCollectionId?: string;
  appwritePricesCollectionId?: string;
  appwriteCategoriesCollectionId?: string;
};

export const DB_ID = extra.appwriteDatabaseId ?? "homie";
export const TASKS_COL = extra.appwriteTasksCollectionId ?? "tasks";
export const SHOPPING_COL = extra.appwriteShoppingCollectionId ?? "shopping_items";
export const EXPENSES_COL = extra.appwriteExpensesCollectionId ?? "expenses";
export const EVENTS_COL = extra.appwriteEventsCollectionId ?? "events";
export const PRODUCTS_COL = extra.appwriteProductsCollectionId ?? "products";
export const PRICES_COL = extra.appwritePricesCollectionId ?? "price_points";
export const CATEGORIES_COL = extra.appwriteCategoriesCollectionId ?? "categories";

export const databases = new Databases(client);
