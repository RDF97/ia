import { Component, type ReactNode } from "react";
import { DevSettings, Pressable, ScrollView, Text, View } from "react-native";
import { clearLastCrash, onFatal, type CrashInfo } from "@/lib/crashGuard";

/**
 * Reinicia la app entera sin tener que ir a "apps recientes" y forzar el cierre.
 * En la APK lo hace expo-updates; el `require` va en try/catch porque en Expo Go
 * el módulo no siempre está y no queremos romper la pantalla de error.
 */
function reloadApp(): void {
  clearLastCrash().catch(() => undefined);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Updates = require("expo-updates");
    if (typeof Updates?.reloadAsync === "function") {
      Updates.reloadAsync().catch(() => DevSettings.reload?.());
      return;
    }
  } catch {
    /* sin expo-updates, probamos el recargador de RN */
  }
  DevSettings.reload?.();
}

/**
 * Red de seguridad: si algo revienta, en vez de dejar la pantalla en blanco
 * muestra el error y un botón para reintentar.
 *
 * Cubre dos casos distintos:
 *  · lo que falla al pintar → `getDerivedStateFromError`, lo normal de React;
 *  · lo que falla FUERA del pintado (temporizadores, promesas, callbacks de
 *    tiempo real) → llega por `onFatal`. Eso React no lo ve, y es lo que dejaba
 *    la app en blanco obligando a forzar el cierre.
 */
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null; crash: CrashInfo | null }
> {
  state: { error: Error | null; crash: CrashInfo | null } = { error: null, crash: null };
  private unsubscribe?: () => void;

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidMount() {
    this.unsubscribe = onFatal((crash) => {
      if (crash.fatal) this.setState({ crash });
    });
  }

  componentWillUnmount() {
    this.unsubscribe?.();
  }

  reset = () => {
    clearLastCrash().catch(() => undefined);
    this.setState({ error: null, crash: null });
  };

  render() {
    const { error, crash } = this.state;
    if (!error && !crash) return this.props.children;

    const message = error?.message ?? crash?.message ?? "Error desconocido";
    const stack = error ? String(error.stack ?? "") : (crash?.stack ?? "");

    return (
      <View style={{ flex: 1, backgroundColor: "#F2F2F7", padding: 24, justifyContent: "center" }}>
        <Text style={{ fontSize: 22, fontWeight: "700", color: "#000", marginBottom: 8 }}>
          Algo se ha roto
        </Text>
        <Text style={{ fontSize: 15, color: "rgba(60,60,67,0.6)", marginBottom: 16 }}>
          Puedes reintentar sin cerrar la app. Si se repite, manda esta captura.
        </Text>
        <ScrollView style={{ maxHeight: 180, marginBottom: 20 }}>
          <Text style={{ fontSize: 12, color: "#FF3B30" }}>
            {message}
            {"\n\n"}
            {stack.slice(0, 800)}
          </Text>
        </ScrollView>
        <Pressable
          onPress={this.reset}
          style={{ backgroundColor: "#1F4D52", borderRadius: 14, paddingVertical: 14, alignItems: "center" }}
        >
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>Reintentar</Text>
        </Pressable>
        <Pressable onPress={reloadApp} style={{ paddingVertical: 14, alignItems: "center" }}>
          <Text style={{ color: "#1F4D52", fontSize: 15 }}>Reiniciar la app</Text>
        </Pressable>
      </View>
    );
  }
}
