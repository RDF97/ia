import { Platform, View } from "react-native";
import { Tabs } from "expo-router";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TabIcon, type TabIconName } from "@/components/TabIcon";
import { useTheme } from "@/theme/theme";

function icon(name: TabIconName) {
  return ({ color, focused }: { color: string; focused: boolean }) => (
    <TabIcon name={name} color={color} focused={focused} />
  );
}

export default function TabsLayout() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const bottom = insets.bottom > 0 ? insets.bottom : 10;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.tabInactive,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "500", marginTop: 2 },
        // Fondo translúcido (frosted glass) como la tab bar del mockup.
        tabBarBackground: () => (
          <BlurView
            intensity={80}
            tint={t.dark ? "systemChromeMaterialDark" : "systemChromeMaterialLight"}
            style={{ flex: 1 }}
          >
            <View style={{ flex: 1, borderTopWidth: 0.5, borderTopColor: t.separator }} />
          </BlurView>
        ),
        tabBarStyle: {
          position: "absolute",
          backgroundColor: Platform.OS === "android" ? (t.dark ? "rgba(20,20,22,0.92)" : "rgba(255,255,255,0.92)") : "transparent",
          borderTopWidth: 0,
          height: 56 + bottom,
          paddingTop: 8,
          paddingBottom: bottom,
          elevation: 0,
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
