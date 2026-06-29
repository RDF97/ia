import type { ReactNode } from "react";
import { Text, View } from "react-native";

export function Card({ children }: { children: ReactNode }) {
  return <View className="bg-white rounded-card mx-4 mb-3 p-4">{children}</View>;
}

/** Tarjeta de marcador de posición para módulos aún por construir. */
export function PhaseCard({ phase, children }: { phase: string; children: ReactNode }) {
  return (
    <Card>
      <Text className="text-[11px] font-semibold uppercase tracking-wide text-accent mb-1">
        {phase}
      </Text>
      <Text className="text-base text-black leading-5">{children}</Text>
    </Card>
  );
}
