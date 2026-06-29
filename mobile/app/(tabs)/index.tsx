import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Card, PhaseCard } from "@/components/Card";
import { useAuth } from "@/lib/auth";
import { useHogar } from "@/lib/hogar";
import { appwriteConfigured } from "@/lib/appwrite";
import { colors } from "@/theme/tokens";

export default function Inicio() {
  const { user, logout } = useAuth();
  const { active, invite } = useHogar();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  // Modo demo (sin backend configurado): mantenemos el marcador.
  if (!appwriteConfigured || !active) {
    return (
      <Screen title="Hola 👋" subtitle="Casa compartida">
        <PhaseCard phase="Fase 6 · Inicio">
          Panel resumen del hogar: gastos del mes, tareas de hoy, compra pendiente,
          deudas y precio de la luz ahora.
        </PhaseCard>
      </Screen>
    );
  }

  const sendInvite = async () => {
    if (!email.trim()) return;
    setBusy(true);
    try {
      await invite(email.trim());
      setInviteOpen(false);
      setEmail("");
      Alert.alert("Invitación enviada", "Le hemos enviado un email con el enlace para unirse al hogar.");
    } catch (e) {
      Alert.alert("No se pudo invitar", e instanceof Error ? e.message : "Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title={`Hola, ${user?.name || ""} 👋`} subtitle={active.name}>
      <Card>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center" style={{ gap: 10 }}>
            <View
              className="rounded-lg2 items-center justify-center"
              style={{ width: 40, height: 40, backgroundColor: colors.accent }}
            >
              <Ionicons name="home" size={20} color="#fff" />
            </View>
            <View>
              <Text className="text-[16px] font-semibold text-black">{active.name}</Text>
              <Text className="text-[13px] text-neutral-500">
                {active.total} {active.total === 1 ? "miembro" : "miembros"}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={() => setInviteOpen(true)}
            className="rounded-pill px-3 py-2 flex-row items-center"
            style={{ backgroundColor: colors.accent, gap: 6 }}
          >
            <Ionicons name="person-add-outline" size={15} color="#fff" />
            <Text className="text-white text-[13px] font-semibold">Invitar</Text>
          </Pressable>
        </View>
      </Card>

      <PhaseCard phase="Fase 6 · Inicio">
        Aquí irá el resumen del hogar (gastos, tareas, compra y precio de la luz).
      </PhaseCard>

      <Pressable onPress={logout} className="mt-2 items-center py-2">
        <Text className="text-[14px]" style={{ color: colors.accent }}>
          Cerrar sesión
        </Text>
      </Pressable>

      <Modal visible={inviteOpen} transparent animationType="slide" onRequestClose={() => setInviteOpen(false)}>
        <Pressable className="flex-1 bg-black/40" onPress={() => setInviteOpen(false)} />
        <View className="bg-bg-app rounded-t-[14px] absolute left-0 right-0 bottom-0 p-5" style={{ paddingBottom: 32 }}>
          <Text className="text-[17px] font-semibold mb-1">Invitar al hogar</Text>
          <Text className="text-[13px] text-neutral-500 mb-4">
            Escribe el email de la persona. Recibirá un enlace para unirse a “{active.name}”.
          </Text>
          <TextInput
            className="bg-white rounded-lg2 px-4 py-3 mb-3 text-[16px] text-black"
            placeholder="email@ejemplo.com"
            placeholderTextColor={colors.labelSecondary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Pressable
            onPress={sendInvite}
            disabled={busy || !email.trim()}
            className="rounded-[14px] py-3.5 items-center"
            style={{ backgroundColor: colors.accent, opacity: busy || !email.trim() ? 0.6 : 1 }}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white text-base font-semibold">Enviar invitación</Text>
            )}
          </Pressable>
        </View>
      </Modal>
    </Screen>
  );
}
