import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/theme/theme";
import { hSelect } from "@/lib/haptics";
import type { IoniconName } from "./ui";

export interface UploadAction {
  key: string;
  label: string;
  icon: IoniconName;
  onPress: () => void;
}

/**
 * Tarjeta con degradado "Subir ticket" del mockup, con N botones.
 * Compra usa 3 (Cámara/Galería/PDF) y Gastos 4 (+ CSV del banco).
 */
export function UploadCard({
  title,
  subtitle,
  icon = "receipt-outline",
  actions,
}: {
  title: string;
  subtitle: string;
  icon?: IoniconName;
  actions: UploadAction[];
}) {
  const t = useTheme();
  // Con 4 botones el texto necesita ir más pequeño para no romperse.
  const compact = actions.length > 3;
  return (
    <View className="mx-4 mb-4">
      <LinearGradient
        colors={[t.accent, "#2A6E75"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderRadius: 18,
          padding: 14,
          shadowColor: t.accent,
          shadowOpacity: 0.22,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
        }}
      >
        <View className="flex-row items-center mb-3" style={{ gap: 10 }}>
          <View
            className="rounded-ctl items-center justify-center"
            style={{ width: 32, height: 32, backgroundColor: "rgba(255,255,255,0.18)" }}
          >
            <Ionicons name={icon} size={18} color="#fff" />
          </View>
          <View className="flex-1">
            <Text className="text-white text-subhead font-semibold">{title}</Text>
            <Text className="text-caption1" style={{ color: "rgba(255,255,255,0.85)" }}>
              {subtitle}
            </Text>
          </View>
        </View>
        <View className="flex-row" style={{ gap: 6 }}>
          {actions.map((a) => (
            <Pressable
              key={a.key}
              onPress={() => {
                hSelect();
                a.onPress();
              }}
              className="flex-1 items-center justify-center rounded-ctl"
              style={{ backgroundColor: "rgba(255,255,255,0.16)", gap: 5, paddingVertical: 10, paddingHorizontal: 2 }}
            >
              <Ionicons name={a.icon} size={compact ? 17 : 18} color="#fff" />
              <Text
                numberOfLines={1}
                className="text-white font-medium"
                style={{ fontSize: compact ? 11 : 12 }}
              >
                {a.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </LinearGradient>
    </View>
  );
}
