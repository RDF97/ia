import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TabIcon, type TabIconName } from "@/components/TabIcon";
import { colors } from "@/theme/tokens";

function icon(name: TabIconName) {
  return ({ color, focused }: { color: string; focused: boolean }) => (
    <TabIcon name={name} color={color} focused={focused} />
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const bottom = insets.bottom > 0 ? insets.bottom : 10;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "500", marginTop: 2 },
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopWidth: 0.5,
          borderTopColor: colors.separator,
          height: 56 + bottom,
          paddingTop: 8,
          paddingBottom: bottom,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Inicio", tabBarIcon: icon("inicio") }} />
      <Tabs.Screen name="gastos" options={{ title: "Gastos", tabBarIcon: icon("gastos") }} />
      <Tabs.Screen name="compra" options={{ title: "Compra", tabBarIcon: icon("compra") }} />
      <Tabs.Screen name="tareas" options={{ title: "Tareas", tabBarIcon: icon("tareas") }} />
      <Tabs.Screen name="calendario" options={{ title: "Calendario", tabBarIcon: icon("calendario") }} />
      <Tabs.Screen name="luz" options={{ title: "Luz", tabBarIcon: icon("luz") }} />
    </Tabs>
  );
}
