import "../global.css";
import "react-native-url-polyfill/auto";

import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { initThemeChoice } from "@/lib/themePref";
import { wireAppState } from "@/lib/appState";
import { useResumeKey } from "@/lib/useResumeKey";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/lib/auth";
import { HogarProvider, useHogar } from "@/lib/hogar";
import { appwriteConfigured } from "@/lib/appwrite";
import { useTheme } from "@/theme/theme";

const queryClient = new QueryClient();

function RootNavigator() {
  const t = useTheme();
  // Al volver del segundo plano tras un rato fuera, se vuelve a montar la vista.
  // Es lo que evita la pantalla en blanco que obligaba a forzar el cierre.
  const resumeKey = useResumeKey();
  const { user, loading: authLoading } = useAuth();
  const { active, loading: hogarLoading } = useHogar();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const seg = segments[0];
    // Modo demo (sin backend configurado): no forzamos login ni hogar.
    if (!appwriteConfigured) {
      if (seg === "login" || seg === "hogar") router.replace("/");
      return;
    }
    if (authLoading) return;
    const inAuth = seg === "login";
    const inOnboarding = seg === "hogar";
    const inJoin = seg === "join";

    if (!user) {
      if (!inAuth) router.replace("/login");
      return;
    }
    if (hogarLoading) return;
    if (!active && !inOnboarding && !inJoin) {
      router.replace("/hogar");
      return;
    }
    if (active && (inAuth || inOnboarding)) {
      router.replace("/");
    }
  }, [user, authLoading, active, hogarLoading, segments, router]);

  if (authLoading && appwriteConfigured) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: t.bg }}>
        <ActivityIndicator color={t.accent} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }} key={resumeKey}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="login" />
      <Stack.Screen name="hogar" />
      <Stack.Screen name="join" />
      <Stack.Screen name="perfil" />
    </Stack>
  );
}

export default function RootLayout() {
  // Aplica el tema guardado (Sistema/Claro/Oscuro) antes de pintar.
  useEffect(() => {
    initThemeChoice().catch(() => undefined);
  }, []);

  // Al volver del segundo plano, refresca los datos (si no, se quedan viejos).
  useEffect(() => wireAppState(queryClient), []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <HogarProvider>
                <RootNavigator />
                <StatusBar style="auto" />
              </HogarProvider>
            </AuthProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
