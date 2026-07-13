import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "@/theme/tokens";

export type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

/** Título de sección: 13px, mayúsculas, espaciado — como .section-title del mockup. */
export function SectionTitle({ children, action, onAction }: { children: ReactNode; action?: string; onAction?: () => void }) {
  return (
    <View className="flex-row items-baseline justify-between pr-5">
      <Text
        className="px-5 pt-4 pb-2 text-[13px] font-medium text-neutral-500"
        style={{ textTransform: "uppercase", letterSpacing: 0.5 }}
      >
        {children}
      </Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={6}>
          <Text className="text-[14px] font-medium" style={{ color: colors.accent }}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Cuadrado de color con icono blanco — como .icon-tile del mockup. */
export function IconTile({
  icon,
  color,
  size = 32,
}: {
  icon: IoniconName;
  color: string;
  size?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 4,
        backgroundColor: color,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name={icon} size={size * 0.55} color="#fff" />
    </View>
  );
}

// Degradados de avatar del mockup (.avatar.ru / .ma / .shared) + extras.
const AVATAR_GRADIENTS: [string, string][] = [
  ["#5AC8FA", "#007AFF"],
  ["#FF6B9D", "#C56CF0"],
  ["#1F4D52", "#5AC8FA"],
  ["#FF9500", "#FF3B30"],
  ["#34C759", "#1F8C4D"],
];

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h;
}

/** Avatar circular con degradado e inicial — como los del mockup. */
export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const grad = AVATAR_GRADIENTS[hashName(name || "?") % AVATAR_GRADIENTS.length];
  return (
    <LinearGradient
      colors={grad}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center" }}
    >
      <Text style={{ color: "#fff", fontWeight: "600", fontSize: size * 0.42 }}>
        {(name || "?").charAt(0).toUpperCase()}
      </Text>
    </LinearGradient>
  );
}

/** Círculo de check — como .shop-check del mockup (borde fino; hecho = accent con tick). */
export function CheckCircle({ done, onPress }: { done: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={10}>
      <View
        style={{
          width: 23,
          height: 23,
          borderRadius: 999,
          borderWidth: done ? 0 : 1.7,
          borderColor: "rgba(60,60,67,0.3)",
          backgroundColor: done ? colors.accent : "transparent",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {done && <Ionicons name="checkmark" size={14} color="#fff" />}
      </View>
    </Pressable>
  );
}

/** Cabecera de card: título 17/600 + acción accent — como .card-head del mockup. */
export function CardHead({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View className="flex-row items-center justify-between mb-3">
      <Text className="text-[17px] font-semibold text-black" style={{ letterSpacing: -0.2 }}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={6}>
          <Text className="text-[14px] font-medium" style={{ color: colors.accent }}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Número tabular (precios/importes alineados) — font-variant del mockup. */
export function Money({ children, size = 15, color, weight = "600" }: { children: ReactNode; size?: number; color?: string; weight?: "400" | "500" | "600" | "700" }) {
  return (
    <Text style={{ fontSize: size, fontWeight: weight, color: color ?? colors.label, fontVariant: ["tabular-nums"], letterSpacing: -0.2 }}>
      {children}
    </Text>
  );
}
