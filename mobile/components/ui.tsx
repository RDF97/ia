import type { ReactNode } from "react";
import { Pressable, type PressableProps, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/theme/theme";
import { hSelect } from "@/lib/haptics";

export type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

/** Pressable con feedback (escala + opacidad) y háptico suave. */
export function PressableScale({
  children,
  onPress,
  haptic = true,
  style,
  ...rest
}: PressableProps & { haptic?: boolean }) {
  return (
    <Pressable
      onPress={(e) => {
        if (haptic) hSelect();
        onPress?.(e);
      }}
      style={(state) => [
        { opacity: state.pressed ? 0.85 : 1, transform: [{ scale: state.pressed ? 0.97 : 1 }] },
        typeof style === "function" ? style(state) : style,
      ]}
      {...rest}
    >
      {children as ReactNode}
    </Pressable>
  );
}

/** Título de sección: 13px, mayúsculas, espaciado — como .section-title del mockup. */
export function SectionTitle({ children, action, onAction }: { children: ReactNode; action?: string; onAction?: () => void }) {
  const t = useTheme();
  return (
    <View className="flex-row items-baseline justify-between pr-5">
      <Text
        className="px-5 pt-4 pb-2 text-[13px] font-medium"
        style={{ color: t.labelSecondary, textTransform: "uppercase", letterSpacing: 0.5 }}
      >
        {children}
      </Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={6}>
          <Text className="text-[14px] font-medium" style={{ color: t.accent }}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Cuadrado de color con icono blanco — como .icon-tile del mockup. */
export function IconTile({ icon, color, size = 32 }: { icon: IoniconName; color: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 4, backgroundColor: color, alignItems: "center", justifyContent: "center" }}>
      <Ionicons name={icon} size={size * 0.55} color="#fff" />
    </View>
  );
}

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

/** Círculo de check — como .shop-check del mockup. */
export function CheckCircle({ done, onPress }: { done: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={() => {
        hSelect();
        onPress();
      }}
      hitSlop={10}
    >
      <View
        style={{
          width: 23,
          height: 23,
          borderRadius: 999,
          borderWidth: done ? 0 : 1.7,
          borderColor: t.labelTertiary,
          backgroundColor: done ? t.accent : "transparent",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {done && <Ionicons name="checkmark" size={14} color={t.onAccent} />}
      </View>
    </Pressable>
  );
}

/** Botón flotante (FAB) redondeado — como el .fab del mockup. Va dentro de `Screen floating`. */
export function Fab({ onPress, icon = "add" }: { onPress: () => void; icon?: IoniconName }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={() => {
        hSelect();
        onPress();
      }}
      className="absolute items-center justify-center"
      style={({ pressed }) => ({
        bottom: 20,
        right: 20,
        width: 56,
        height: 56,
        borderRadius: 18,
        backgroundColor: t.accent,
        transform: [{ scale: pressed ? 0.94 : 1 }],
        shadowColor: t.accent,
        shadowOpacity: 0.35,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 8,
      })}
    >
      <Ionicons name={icon} size={26} color={t.onAccent} />
    </Pressable>
  );
}

/** Número tabular (precios/importes alineados). */
export function Money({ children, size = 15, color, weight = "600" }: { children: ReactNode; size?: number; color?: string; weight?: "400" | "500" | "600" | "700" }) {
  const t = useTheme();
  return (
    <Text style={{ fontSize: size, fontWeight: weight, color: color ?? t.label, fontVariant: ["tabular-nums"], letterSpacing: -0.2 }}>
      {children}
    </Text>
  );
}
