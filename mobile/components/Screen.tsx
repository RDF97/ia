import { useState, type ReactNode } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/theme";

// Alto de la barra de pestañas (absoluta): 56 + inset inferior (mín. 10).
// Debe coincidir con app/(tabs)/_layout.tsx para anclar la capa flotante encima.
const TAB_BAR_BASE = 56;

export function Screen({
  title,
  subtitle,
  right,
  onRefresh,
  children,
  floating,
  contentBottom = 96,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onRefresh?: () => Promise<unknown>;
  children?: ReactNode;
  /** Capa flotante (pill de "añadir", FAB…) anclada sobre la barra de pestañas. */
  floating?: ReactNode;
  /** Espacio inferior del scroll (súbelo si hay una pill flotante). */
  contentBottom?: number;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarH = TAB_BAR_BASE + (insets.bottom > 0 ? insets.bottom : 10);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: t.bg }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: contentBottom }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={t.accent} />
          ) : undefined
        }
      >
        <View className="px-5 pt-2 pb-2 flex-row items-end justify-between">
          <View className="flex-1 pr-3">
            <Text className="text-[34px] font-bold" style={{ lineHeight: 41, letterSpacing: -0.5, color: t.label }}>
              {title}
            </Text>
            {subtitle ? (
              <Text className="text-[13px] mt-1" style={{ color: t.labelSecondary }}>{subtitle}</Text>
            ) : null}
          </View>
          {right}
        </View>
        {children}
      </ScrollView>
      {floating ? (
        // Anclada por encima de la barra de pestañas (que es absoluta y taparía el FAB).
        <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom: tabBarH, top: 0 }}>
          {floating}
        </View>
      ) : null}
    </SafeAreaView>
  );
}
