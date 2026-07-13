import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Muestra las notificaciones también con la app abierta.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let channelReady = false;

export async function ensureNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === "android" && !channelReady) {
    await Notifications.setNotificationChannelAsync("luz", {
      name: "Avisos de la luz",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
    channelReady = true;
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

/** Programa una notificación local para una fecha concreta. Devuelve su id o null si la fecha ya pasó. */
export async function scheduleAt(
  date: Date,
  title: string,
  body: string,
): Promise<string | null> {
  if (date.getTime() <= Date.now() + 5000) return null;
  return Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
      channelId: Platform.OS === "android" ? "luz" : undefined,
    },
  });
}

/** Notificación diaria recurrente (hora local). Devuelve su id. */
export async function scheduleDaily(
  hour: number,
  minute: number,
  title: string,
  body: string,
): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      channelId: Platform.OS === "android" ? "luz" : undefined,
    },
  });
}

export async function cancelScheduled(ids: string[]): Promise<void> {
  await Promise.all(
    ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)),
  );
}

// --- Persistencia de grupos de avisos (para poder cancelarlos al apagar un toggle) ---

const KEY = (group: string) => `luz-notif-ids:${group}`;
const TOGGLE_KEY = (group: string) => `luz-notif-on:${group}`;

export async function saveGroupIds(group: string, ids: string[]): Promise<void> {
  await AsyncStorage.setItem(KEY(group), JSON.stringify(ids));
}

export async function cancelGroup(group: string): Promise<void> {
  const raw = await AsyncStorage.getItem(KEY(group));
  if (raw) {
    try {
      await cancelScheduled(JSON.parse(raw));
    } catch {
      /* noop */
    }
  }
  await AsyncStorage.removeItem(KEY(group));
}

export async function setToggle(group: string, on: boolean): Promise<void> {
  await AsyncStorage.setItem(TOGGLE_KEY(group), on ? "1" : "0");
}

export async function getToggle(group: string, def: boolean): Promise<boolean> {
  const raw = await AsyncStorage.getItem(TOGGLE_KEY(group));
  return raw === null ? def : raw === "1";
}
