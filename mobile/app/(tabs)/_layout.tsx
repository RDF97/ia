import { useEffect } from "react";
import { Platform, View } from "react-native";
import { Tabs } from "expo-router";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TabIcon, type TabIconName } from "@/components/TabIcon";
import { useAuth } from "@/lib/auth";
import { useHogar } from "@/lib/hogar";
import { useExpenseAlerts } from "@/lib/expenseAlerts";
import { useProfileSync } from "@/lib/useProfileSync";
import { useTasks } from "@/lib/useTasks";
import { syncTaskReminders } from "@/lib/taskReminders";
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
  const { user } = useAuth();
  const { active } = useHogar();

  // Aviso cuando otra persona del hogar apunta un gasto.
  useExpenseAlerts(active?.$id, user?.name || "");
  // Publica mi nombre e icono en el hogar: Appwrite no deja que los demás los
  // lean de mi cuenta, así que sin esto todos salimos como "sin nombre".
  useProfileSync(active?.$id, user?.$id, user?.name || "", t.accent);

  // Los avisos de tarea se sincronizan AQUÍ y no dentro de la pestaña Tareas:
  // las pestañas se montan solo al visitarlas, así que si completabas o borrabas
  // una tarea desde el Calendario sin haber entrado en Tareas, su aviso seguía
  // programado y saltaba igual. Esto está siempre montado.
  const { data: tasks } = useTasks(active?.$id);
  useEffect(() => {
    if (tasks) syncTaskReminders(tasks, user?.name || "Yo").catch(() => undefined);
  }, [tasks, user?.name]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.tabInactive,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "500", marginTop: 2 },
        // Fondo translúcido (frosted glass) como la tab bar del mockup.
        //
        // Solo en iOS: en Android el desenfoque de expo-blur se pinta a base de
        // capturar la ventana en cada frame, es la pieza más frágil cuando la
        // app vuelve del segundo plano, y aquí no aporta nada porque debajo ya
        // hay un color sólido casi opaco. Fuera riesgo a cambio de nada.
        tabBarBackground:
          Platform.OS === "ios"
            ? () => (
                <BlurView
                  intensity={80}
                  tint={t.dark ? "systemChromeMaterialDark" : "systemChromeMaterialLight"}
                  style={{ flex: 1 }}
                >
                  <View style={{ flex: 1, borderTopWidth: 0.5, borderTopColor: t.separator }} />
                </BlurView>
              )
            : () => <View style={{ flex: 1, borderTopWidth: 0.5, borderTopColor: t.separator }} />,
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
