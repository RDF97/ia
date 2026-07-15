import * as Haptics from "expo-haptics";

// Envolturas seguras (no-op si el dispositivo no soporta hápticos).
export const hSelect = () => {
  Haptics.selectionAsync().catch(() => undefined);
};
export const hImpact = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
};
export const hSuccess = () => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
};
export const hWarn = () => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
};
