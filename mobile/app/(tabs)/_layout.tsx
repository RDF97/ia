import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/theme/tokens";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

function icon(name: IoniconName) {
  return ({ color, size }: { color: string; size: number }) => (
    <Ionicons name={name} color={color} size={size} />
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: { borderTopWidth: 0.5, borderTopColor: colors.separator },
        tabBarLabelStyle: { fontSize: 10 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Inicio", tabBarIcon: icon("home-outline") }} />
      <Tabs.Screen name="gastos" options={{ title: "Gastos", tabBarIcon: icon("cash-outline") }} />
      <Tabs.Screen name="compra" options={{ title: "Compra", tabBarIcon: icon("cart-outline") }} />
      <Tabs.Screen name="tareas" options={{ title: "Tareas", tabBarIcon: icon("checkbox-outline") }} />
      <Tabs.Screen name="calendario" options={{ title: "Calendario", tabBarIcon: icon("calendar-outline") }} />
      <Tabs.Screen name="luz" options={{ title: "Luz", tabBarIcon: icon("flash-outline") }} />
    </Tabs>
  );
}
