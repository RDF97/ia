import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/theme/theme";
import { hSelect } from "@/lib/haptics";
import { ICON_COLORS, type IconStyle } from "@/lib/appearance";
import type { IoniconName } from "./ui";

/** Hoja para elegir icono y color (del hogar o del perfil). */
export function IconPickerModal({
  visible,
  title,
  icons,
  value,
  onClose,
  onSave,
  onReset,
}: {
  visible: boolean;
  title: string;
  icons: IoniconName[];
  value: IconStyle;
  onClose: () => void;
  onSave: (style: IconStyle) => Promise<void>;
  /** Si se pasa, muestra "Quitar" para volver a las iniciales. */
  onReset?: () => Promise<void>;
}) {
  const t = useTheme();
  const [icon, setIcon] = useState<IoniconName>(value.icon);
  const [color, setColor] = useState<string>(value.color);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setIcon(value.icon);
      setColor(value.color);
    }
  }, [visible, value.icon, value.color]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      onClose();
    } catch (e) {
      Alert.alert("No se pudo guardar", e instanceof Error ? e.message : "Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1" style={{ backgroundColor: t.overlay }} onPress={onClose} />
      <View
        className="rounded-t-[14px] absolute left-0 right-0 bottom-0"
        style={{ backgroundColor: t.bg, paddingBottom: 32 }}
      >
        <View className="items-center pt-2 pb-1">
          <View style={{ width: 36, height: 5, borderRadius: 999, backgroundColor: t.separator }} />
        </View>
        <View
          className="flex-row items-center justify-between px-5 py-3"
          style={{ borderBottomWidth: 0.5, borderBottomColor: t.separator }}
        >
          <Pressable onPress={onClose} hitSlop={8}>
            <Text className="text-base text-accent">Cancelar</Text>
          </Pressable>
          <Text className="text-[17px] font-semibold text-label">{title}</Text>
          <View style={{ width: 62 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {/* Vista previa */}
          <View className="items-center mb-5">
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 22,
                backgroundColor: color,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name={icon} size={36} color="#fff" />
            </View>
          </View>

          <Text className="text-[12px] font-medium uppercase tracking-wide text-secondary mb-2">Icono</Text>
          <View className="flex-row flex-wrap mb-5" style={{ gap: 10 }}>
            {icons.map((ic) => {
              const on = ic === icon;
              return (
                <Pressable
                  key={ic}
                  onPress={() => {
                    hSelect();
                    setIcon(ic);
                  }}
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 14,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: on ? color : t.fill,
                    borderWidth: on ? 2 : 0,
                    borderColor: t.label,
                  }}
                >
                  <Ionicons name={ic} size={24} color={on ? "#fff" : t.labelSecondary} />
                </Pressable>
              );
            })}
          </View>

          <Text className="text-[12px] font-medium uppercase tracking-wide text-secondary mb-2">Color</Text>
          <View className="flex-row flex-wrap mb-6" style={{ gap: 10 }}>
            {ICON_COLORS.map((c) => {
              const on = c === color;
              return (
                <Pressable
                  key={c}
                  onPress={() => {
                    hSelect();
                    setColor(c);
                  }}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 999,
                    backgroundColor: c,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: on ? 3 : 0,
                    borderColor: t.label,
                  }}
                >
                  {on && <Ionicons name="checkmark" size={18} color="#fff" />}
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={() => run(() => onSave({ icon, color }))}
            disabled={busy}
            className="rounded-[14px] py-3.5 items-center"
            style={{ backgroundColor: t.accent, opacity: busy ? 0.6 : 1 }}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white text-base font-semibold">Guardar</Text>
            )}
          </Pressable>

          {onReset && (
            <Pressable onPress={() => run(onReset)} disabled={busy} className="mt-3 items-center py-1">
              <Text className="text-[14px]" style={{ color: t.accent }}>Quitar icono · usar mis iniciales</Text>
            </Pressable>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
