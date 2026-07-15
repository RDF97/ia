import { useState, type ReactNode } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/theme/theme";

export function Screen({
  title,
  subtitle,
  right,
  onRefresh,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onRefresh?: () => Promise<unknown>;
  children?: ReactNode;
}) {
  const t = useTheme();
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
        contentContainerStyle={{ paddingBottom: 96 }}
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
    </SafeAreaView>
  );
}
