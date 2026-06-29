import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme/tokens";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

function icon(name: IoniconName) {
  return ({ color }: { color: string }) => <Ionicons name={name} color={color} size={26} />;
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
      <Tabs.Screen name="index" options={{ title: "Inicio", tabBarIcon: icon("home-outline") }} />
      <Tabs.Screen name="gastos" options={{ title: "Gastos", tabBarIcon: icon("cash-outline") }} />
      <Tabs.Screen name="compra" options={{ title: "Compra", tabBarIcon: icon("cart-outline") }} />
      <Tabs.Screen name="tareas" options={{ title: "Tareas", tabBarIcon: icon("checkbox-outline") }} />
      <Tabs.Screen name="calendario" options={{ title: "Calendario", tabBarIcon: icon("calendar-outline") }} />
      <Tabs.Screen name="luz" options={{ title: "Luz", tabBarIcon: icon("flash-outline") }} />
    </Tabs>
  );
}
