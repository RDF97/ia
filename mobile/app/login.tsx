import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth";
import { appwriteConfigured } from "@/lib/appwrite";
import { useTheme } from "@/theme/theme";

export default function Login() {
  const t = useTheme();
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      if (mode === "register") await register(name.trim(), email.trim(), password);
      else await login(email.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar la operación");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}>
          <View className="items-center mb-8">
            <View
              className="rounded-card items-center justify-center mb-3"
              style={{ width: 64, height: 64, backgroundColor: t.accent }}
            >
              <Text className="text-white text-3xl font-bold">C</Text>
            </View>
            <Text className="text-[28px] font-bold text-label">Clara</Text>
            <Text className="text-[14px] text-secondary mt-1">
              {mode === "login" ? "Inicia sesión en tu hogar" : "Crea tu cuenta"}
            </Text>
          </View>

          {!appwriteConfigured && (
            <View className="bg-card rounded-lg2 p-3 mb-4" style={{ borderWidth: 1, borderColor: t.orange }}>
              <Text className="text-[13px] text-label">
                Backend no configurado todavía. Añade tu endpoint y Project ID de Appwrite en
                app.json para activar el login.
              </Text>
            </View>
          )}

          {mode === "register" && (
            <TextInput
              className="bg-card rounded-lg2 px-4 py-3 mb-3 text-[16px] text-label"
              placeholder="Nombre"
              placeholderTextColor={t.labelTertiary}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          )}
          <TextInput
            className="bg-card rounded-lg2 px-4 py-3 mb-3 text-[16px] text-label"
            placeholder="Email"
            placeholderTextColor={t.labelTertiary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <TextInput
            className="bg-card rounded-lg2 px-4 py-3 mb-3 text-[16px] text-label"
            placeholder="Contraseña"
            placeholderTextColor={t.labelTertiary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {error && <Text className="text-[13px] mb-3" style={{ color: t.red }}>{error}</Text>}

          <Pressable
            onPress={submit}
            disabled={busy}
            className="rounded-[14px] py-3.5 items-center"
            style={{ backgroundColor: t.accent, opacity: busy ? 0.6 : 1 }}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white text-base font-semibold">
                {mode === "login" ? "Entrar" : "Crear cuenta"}
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => {
              setError(null);
              setMode(mode === "login" ? "register" : "login");
            }}
            className="mt-4 items-center"
          >
            <Text className="text-[14px]" style={{ color: t.accent }}>
              {mode === "login" ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Inicia sesión"}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
