import type { ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export function Screen({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <SafeAreaView className="flex-1 bg-bg-app" edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="px-5 pt-2 pb-1 flex-row items-end justify-between">
          <View className="flex-1 pr-3">
            <Text className="text-[34px] font-bold tracking-tight text-black" style={{ lineHeight: 41 }}>
              {title}
            </Text>
            {subtitle ? (
              <Text className="text-[13px] text-neutral-500 mt-1">{subtitle}</Text>
            ) : null}
          </View>
          {right}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
