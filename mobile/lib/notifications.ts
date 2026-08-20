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

/** Canal de Android para lo que pasa en el hogar (gastos, tareas, eventos). */
export const HOGAR_CHANNEL = "hogar";

export async function ensureNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === "android" && !channelReady) {
    await Notifications.setNotificationChannelAsync("luz", {
      name: "Avisos de la luz",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
    // Separado del de la luz para que se puedan silenciar por separado desde
    // los ajustes de Android (y porque "Avisos de la luz" no describe un gasto).
    await Notifications.setNotificationChannelAsync(HOGAR_CHANNEL, {
      name: "Avisos del hogar",
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

/**
 * Programa una notificación local para una fecha concreta. Devuelve su id, o
 * null si la fecha ya pasó.
 *
 * El canal se puede elegir: en Android es lo que decide en qué grupo de los
 * ajustes del sistema cae el aviso. Tareas y eventos van al canal del hogar; si
 * fueran todos por el de la luz, silenciar los precios de la luz silenciaría
 * también los recordatorios de las tareas.
 */
export async function scheduleAt(
  date: Date,
  title: string,
  body: string,
  channel: string = "luz",
): Promise<string | null> {
  if (date.getTime() <= Date.now() + 5000) return null;
  return Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
      channelId: Platform.OS === "android" ? channel : undefined,
    },
  });
}

/** Muestra una notificación ya mismo (avisos de cosas que acaban de pasar). */
export async function notifyNow(title: string, body: string): Promise<void> {
  if (!(await notificationsGranted())) return;
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger:
      Platform.OS === "android"
        ? { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1, channelId: HOGAR_CHANNEL }
        : null,
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

export async function notificationsGranted(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  return current.granted;
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
