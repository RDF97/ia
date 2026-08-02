import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { useAuth } from "@/lib/auth";
import { useHogar } from "@/lib/hogar";
import { InviteModal } from "@/components/InviteModal";
import { Avatar } from "@/components/ui";
import { IconPickerModal } from "@/components/IconPickerModal";
import { Segmented } from "@/components/Segmented";
import { getThemeChoice, setThemeChoice, THEME_OPTIONS, type ThemeChoice } from "@/lib/themePref";
import {
  getHogarIcon,
  getPerfilIcon,
  setHogarIcon,
  setPerfilIcon,
  HOGAR_ICONS,
  PERFIL_ICONS,
  type IconStyle,
} from "@/lib/appearance";
import { useTheme } from "@/theme/theme";

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
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center px-4 py-3"
      style={{ gap: 12, borderTopWidth: first ? 0 : 0.5, borderTopColor: t.separator }}
    >
      <View className="rounded-lg items-center justify-center" style={{ width: 30, height: 30, backgroundColor: color }}>
        <Ionicons name={icon} size={15} color="#fff" />
      </View>
      <Text className="flex-1 text-[15px]" style={{ color: danger ? t.red : t.label }}>
        {label}
      </Text>
      <Ionicons name="chevron-forward" size={16} color={t.tabInactive} />
    </Pressable>
  );
}

export default function Perfil() {
  const t = useTheme();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { active, leaveHogar } = useHogar();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [hogarIcon, setHogarIconState] = useState<IconStyle>({ icon: "home", color: t.accent });
  const [perfilIcon, setPerfilIconState] = useState<IconStyle | null>(null);
  const [pick, setPick] = useState<"hogar" | "perfil" | null>(null);
  const [theme, setTheme] = useState<ThemeChoice>("system");

  useEffect(() => {
    getThemeChoice().then(setTheme).catch(() => undefined);
  }, []);

  const loadIcons = useCallback(() => {
    if (active) getHogarIcon(active.$id, t.accent).then(setHogarIconState).catch(() => undefined);
    getPerfilIcon(t.accent).then(setPerfilIconState).catch(() => undefined);
  }, [active, t.accent]);

  useEffect(loadIcons, [loadIcons]);

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
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <View className="flex-row items-center px-4 py-2" style={{ gap: 8 }}>
        <Pressable onPress={() => router.back()} hitSlop={8} className="flex-row items-center">
          <Ionicons name="chevron-back" size={24} color={t.accent} />
          <Text className="text-[16px]" style={{ color: t.accent }}>Inicio</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="px-5 pt-1 pb-3">
          <Text className="text-[34px] font-bold tracking-tight text-label" style={{ lineHeight: 41 }}>
            Perfil
          </Text>
        </View>

        {/* Cuenta */}
        <View className="bg-card rounded-card mx-4 mb-3 p-4 flex-row items-center" style={{ gap: 14 }}>
          <Pressable onPress={() => setPick("perfil")} hitSlop={6}>
            {perfilIcon ? (
              <View
                style={{
                  width: 52, height: 52, borderRadius: 26,
                  backgroundColor: perfilIcon.color,
                  alignItems: "center", justifyContent: "center",
                }}
              >
                <Ionicons name={perfilIcon.icon} size={26} color="#fff" />
              </View>
            ) : (
              <Avatar name={user?.name || user?.email || "?"} size={52} />
            )}
            <View
              style={{
                position: "absolute", right: -2, bottom: -2,
                width: 20, height: 20, borderRadius: 10,
                backgroundColor: t.accent, alignItems: "center", justifyContent: "center",
                borderWidth: 2, borderColor: t.card,
              }}
            >
              <Ionicons name="pencil" size={9} color="#fff" />
            </View>
          </Pressable>
          <View className="flex-1">
            <Text className="text-[17px] font-semibold text-label">{user?.name || "Sin nombre"}</Text>
            <Text className="text-[13px] text-secondary mt-0.5">{user?.email}</Text>
          </View>
        </View>

        {/* Hogar */}
        {active && (
          <>
            <Text className="px-5 pt-2 pb-2 text-[13px] font-medium uppercase tracking-wide text-secondary">
              Tu hogar
            </Text>
            <View className="bg-card rounded-lg2 mx-4 mb-3 overflow-hidden">
              <Pressable onPress={() => setPick("hogar")} className="flex-row items-center px-4 py-3" style={{ gap: 12 }}>
                <View className="rounded-lg items-center justify-center" style={{ width: 30, height: 30, backgroundColor: hogarIcon.color }}>
                  <Ionicons name={hogarIcon.icon} size={15} color="#fff" />
                </View>
                <View className="flex-1">
                  <Text className="text-[15px] text-label">{active.name}</Text>
                  <Text className="text-[12px] text-secondary">
                    {active.total} {active.total === 1 ? "miembro" : "miembros"}
                  </Text>
                </View>
                <Text className="text-[13px]" style={{ color: t.accent }}>Cambiar icono</Text>
              </Pressable>
              <Row icon="person-add" color={t.green} label="Invitar a alguien" onPress={() => setInviteOpen(true)} />
              <Row icon="exit-outline" color={t.red} label="Salir del hogar" danger onPress={confirmLeave} />
            </View>
          </>
        )}

        {/* Apariencia */}
        <Text className="px-5 pt-2 pb-2 text-[13px] font-medium uppercase tracking-wide text-secondary">
          Apariencia
        </Text>
        <Segmented
          value={theme}
          onChange={(k) => {
            setTheme(k);
            setThemeChoice(k).catch(() => undefined);
          }}
          options={THEME_OPTIONS}
        />
        <Text className="px-5 pb-3 text-[12px] text-tertiary">
          “Claro” deja siempre los colores del diseño original (verde {"#1F4D52"}); en oscuro el
          acento se aclara para que se lea bien.
        </Text>

        {/* Sesión */}
        <Text className="px-5 pt-2 pb-2 text-[13px] font-medium uppercase tracking-wide text-secondary">
          Cuenta
        </Text>
        <View className="bg-card rounded-lg2 mx-4 mb-3 overflow-hidden">
          <Row first icon="log-out-outline" color={t.gray} label="Cerrar sesión" danger onPress={confirmLogout} />
        </View>

        <Text className="text-center text-[12px] text-tertiary mt-4">
          Homie v{Constants.expoConfig?.version ?? "0.1.0"} · hecho con ♥
        </Text>
      </ScrollView>

      {active && <InviteModal visible={inviteOpen} hogarName={active.name} onClose={() => setInviteOpen(false)} />}

      <IconPickerModal
        visible={pick === "hogar"}
        title="Icono del hogar"
        icons={HOGAR_ICONS}
        value={hogarIcon}
        onClose={() => setPick(null)}
        onSave={async (st) => {
          if (!active) return;
          await setHogarIcon(active.$id, st);
          setHogarIconState(st);
        }}
      />
      <IconPickerModal
        visible={pick === "perfil"}
        title="Icono del perfil"
        icons={PERFIL_ICONS}
        value={perfilIcon ?? { icon: "person", color: t.accent }}
        onClose={() => setPick(null)}
        onSave={async (st) => {
          await setPerfilIcon(st);
          setPerfilIconState(st);
        }}
        onReset={async () => {
          await setPerfilIcon(null);
          setPerfilIconState(null);
        }}
      />
    </SafeAreaView>
  );
}
