import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { useAuth } from "@/lib/auth";
import { useHogar } from "@/lib/hogar";
import { InviteModal } from "@/components/InviteModal";
import { colors } from "@/theme/tokens";

function Row({
  icon,
  color,
  label,
  danger,
  onPress,
  first,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  color: string;
  label: string;
  danger?: boolean;
  onPress: () => void;
  first?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center px-4 py-3"
      style={{ gap: 12, borderTopWidth: first ? 0 : 0.5, borderTopColor: colors.separator }}
    >
      <View className="rounded-lg items-center justify-center" style={{ width: 30, height: 30, backgroundColor: color }}>
        <Ionicons name={icon} size={15} color="#fff" />
      </View>
      <Text className="flex-1 text-[15px]" style={{ color: danger ? colors.red : colors.label }}>
        {label}
      </Text>
      <Ionicons name="chevron-forward" size={16} color={colors.tabInactive} />
    </Pressable>
  );
}

export default function Perfil() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { active, leaveHogar } = useHogar();
  const [inviteOpen, setInviteOpen] = useState(false);
  const initial = (user?.name || user?.email || "?").charAt(0).toUpperCase();

  const confirmLeave = () => {
    if (!active) return;
    const soleMember = active.total <= 1;
    Alert.alert(
      "Salir del hogar",
      soleMember
        ? `Eres el único miembro: “${active.name}” y sus datos dejarán de estar disponibles. ¿Seguro?`
        : `Dejarás de ver los datos de “${active.name}”. ¿Seguro?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Salir",
          style: "destructive",
          onPress: async () => {
            try {
              await leaveHogar();
              router.replace("/hogar");
            } catch (e) {
              Alert.alert("No se pudo salir", e instanceof Error ? e.message : "Inténtalo de nuevo.");
            }
          },
        },
      ],
    );
  };

  const confirmLogout = () => {
    Alert.alert("Cerrar sesión", "¿Seguro que quieres salir?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Cerrar sesión", style: "destructive", onPress: () => logout() },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-bg-app" edges={["top"]}>
      <View className="flex-row items-center px-4 py-2" style={{ gap: 8 }}>
        <Pressable onPress={() => router.back()} hitSlop={8} className="flex-row items-center">
          <Ionicons name="chevron-back" size={24} color={colors.accent} />
          <Text className="text-[16px]" style={{ color: colors.accent }}>Inicio</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="px-5 pt-1 pb-3">
          <Text className="text-[34px] font-bold tracking-tight text-black" style={{ lineHeight: 41 }}>
            Perfil
          </Text>
        </View>

        {/* Cuenta */}
        <View className="bg-white rounded-card mx-4 mb-3 p-4 flex-row items-center" style={{ gap: 14 }}>
          <View className="rounded-pill items-center justify-center" style={{ width: 52, height: 52, backgroundColor: colors.accent }}>
            <Text className="text-white text-[22px] font-bold">{initial}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-[17px] font-semibold text-black">{user?.name || "Sin nombre"}</Text>
            <Text className="text-[13px] text-neutral-500 mt-0.5">{user?.email}</Text>
          </View>
        </View>

        {/* Hogar */}
        {active && (
          <>
            <Text className="px-5 pt-2 pb-2 text-[13px] font-medium uppercase tracking-wide text-neutral-500">
              Tu hogar
            </Text>
            <View className="bg-white rounded-lg2 mx-4 mb-3 overflow-hidden">
              <View className="flex-row items-center px-4 py-3" style={{ gap: 12 }}>
                <View className="rounded-lg items-center justify-center" style={{ width: 30, height: 30, backgroundColor: colors.accent }}>
                  <Ionicons name="home" size={15} color="#fff" />
                </View>
                <View className="flex-1">
                  <Text className="text-[15px] text-black">{active.name}</Text>
                  <Text className="text-[12px] text-neutral-500">
                    {active.total} {active.total === 1 ? "miembro" : "miembros"}
                  </Text>
                </View>
              </View>
              <Row icon="person-add" color={colors.green} label="Invitar a alguien" onPress={() => setInviteOpen(true)} />
              <Row icon="exit-outline" color={colors.red} label="Salir del hogar" danger onPress={confirmLeave} />
            </View>
          </>
        )}

        {/* Sesión */}
        <Text className="px-5 pt-2 pb-2 text-[13px] font-medium uppercase tracking-wide text-neutral-500">
          Cuenta
        </Text>
        <View className="bg-white rounded-lg2 mx-4 mb-3 overflow-hidden">
          <Row first icon="log-out-outline" color="#8E8E93" label="Cerrar sesión" danger onPress={confirmLogout} />
        </View>

        <Text className="text-center text-[12px] text-neutral-400 mt-4">
          Homie v{Constants.expoConfig?.version ?? "0.1.0"} · hecho con ♥
        </Text>
      </ScrollView>

      {active && <InviteModal visible={inviteOpen} hogarName={active.name} onClose={() => setInviteOpen(false)} />}
    </SafeAreaView>
  );
}
