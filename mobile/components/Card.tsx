import type { ReactNode } from "react";
import { Text, View, type ViewStyle } from "react-native";
import { useTheme } from "@/theme/theme";

// Sombra sutil estilo iOS (solo en claro; en oscuro molesta).
export function cardShadow(dark: boolean): ViewStyle {
  return dark
    ? {}
    : { shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 };
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return (
    <View
      style={[{ backgroundColor: t.card, borderRadius: 18, marginHorizontal: 16, marginBottom: 12, padding: 16 }, cardShadow(t.dark), style]}
    >
      {children}
    </View>
  );
}

/** Tarjeta de marcador de posición para módulos aún por construir. */
export function PhaseCard({ phase, children }: { phase: string; children: ReactNode }) {
  const t = useTheme();
  return (
    <Card>
      <Text className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: t.accent }}>
        {phase}
      </Text>
      <Text className="text-base leading-5" style={{ color: t.label }}>{children}</Text>
    </Card>
  );
}
