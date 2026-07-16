import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useHogar } from "@/lib/hogar";
import { useAuth } from "@/lib/auth";
import { redeemInvite } from "@/lib/invites";
import { useTheme } from "@/theme/theme";

export default function HogarOnboarding() {
  const t = useTheme();
  const { createHogar, reload } = useHogar();
  const { logout } = useAuth();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

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

  const join = async () => {
    if (!code.trim()) return;
    setJoining(true);
    setJoinError(null);
    try {
      await redeemInvite(code);
      await reload(); // el candado de navegación te lleva a las pestañas
    } catch (e) {
      setJoinError(e instanceof Error ? e.message : "No se pudo unir al hogar");
    } finally {
      setJoining(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-1 justify-center px-6">
        <Text className="text-[28px] font-bold text-label" style={{ lineHeight: 34 }}>
          Crea tu hogar
        </Text>
        <Text className="text-[14px] text-secondary mt-1 mb-6">
          Un "hogar" es el espacio que compartís. Luego podrás invitar a otra persona.
        </Text>

        <TextInput
          className="bg-card rounded-lg2 px-4 py-3 mb-3 text-[16px] text-label"
          placeholder="Nombre del hogar (p. ej. Casa Ruben · María)"
          placeholderTextColor={t.labelTertiary}
          value={name}
          onChangeText={setName}
          autoCapitalize="sentences"
        />

        {error && <Text className="text-[13px] mb-3" style={{ color: t.red }}>{error}</Text>}

        <Pressable
          onPress={submit}
          disabled={busy || !name.trim()}
          className="rounded-[14px] py-3.5 items-center"
          style={{ backgroundColor: t.accent, opacity: busy || !name.trim() ? 0.6 : 1 }}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white text-base font-semibold">Crear hogar</Text>
          )}
        </Pressable>

        <View className="flex-row items-center my-6" style={{ gap: 12 }}>
          <View className="flex-1" style={{ height: 0.5, backgroundColor: t.separator }} />
          <Text className="text-[12px] text-tertiary">o únete a uno</Text>
          <View className="flex-1" style={{ height: 0.5, backgroundColor: t.separator }} />
        </View>

        <Text className="text-[14px] text-secondary mb-2">
          ¿Te han invitado? Pega aquí el código (o abre el enlace que te han pasado).
        </Text>
        <View className="flex-row" style={{ gap: 8 }}>
          <TextInput
            className="flex-1 bg-card rounded-lg2 px-4 py-3 text-[16px] text-label"
            placeholder="Código de invitación"
            placeholderTextColor={t.labelTertiary}
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <Pressable
            onPress={join}
            disabled={joining || !code.trim()}
            className="rounded-lg2 px-5 items-center justify-center"
            style={{ backgroundColor: t.accent, opacity: joining || !code.trim() ? 0.6 : 1 }}
          >
            {joining ? <ActivityIndicator color="#fff" /> : <Text className="text-white text-base font-semibold">Unirme</Text>}
          </Pressable>
        </View>
        {joinError && <Text className="text-[13px] mt-2" style={{ color: t.red }}>{joinError}</Text>}

        <Pressable onPress={logout} className="mt-6 items-center">
          <Text className="text-[14px]" style={{ color: t.accent }}>
            Cerrar sesión
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
