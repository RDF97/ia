import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useHogar } from "@/lib/hogar";
import { useAuth } from "@/lib/auth";
import { colors } from "@/theme/tokens";

export default function HogarOnboarding() {
  const { createHogar } = useHogar();
  const { logout } = useAuth();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createHogar(name.trim());
      // Al crearse, el candado de navegación lleva a las pestañas.
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear el hogar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-bg-app">
      <View className="flex-1 justify-center px-6">
        <Text className="text-[28px] font-bold text-black" style={{ lineHeight: 34 }}>
          Crea tu hogar
        </Text>
        <Text className="text-[14px] text-neutral-500 mt-1 mb-6">
          Un "hogar" es el espacio que compartís. Luego podrás invitar a otra persona.
        </Text>

        <TextInput
          className="bg-white rounded-lg2 px-4 py-3 mb-3 text-[16px] text-black"
          placeholder="Nombre del hogar (p. ej. Casa Ruben · María)"
          placeholderTextColor={colors.labelSecondary}
          value={name}
          onChangeText={setName}
          autoCapitalize="sentences"
        />

        {error && <Text className="text-[13px] mb-3" style={{ color: colors.red }}>{error}</Text>}

        <Pressable
          onPress={submit}
          disabled={busy || !name.trim()}
          className="rounded-[14px] py-3.5 items-center"
          style={{ backgroundColor: colors.accent, opacity: busy || !name.trim() ? 0.6 : 1 }}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white text-base font-semibold">Crear hogar</Text>
          )}
        </Pressable>

        <Text className="text-[13px] text-neutral-500 text-center mt-6">
          ¿Te han invitado? Abre el enlace de invitación que te han enviado.
        </Text>

        <Pressable onPress={logout} className="mt-4 items-center">
          <Text className="text-[14px]" style={{ color: colors.accent }}>
            Cerrar sesión
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
