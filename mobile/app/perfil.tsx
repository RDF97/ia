import { useEffect, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { useAuth } from "@/lib/auth";
import { useHogar } from "@/lib/hogar";
import { InviteModal } from "@/components/InviteModal";
import { Avatar, type IoniconName, SectionTitle } from "@/components/ui";
import { ListGroup, Row, RowIcon } from "@/components/List";
import { IconPickerModal } from "@/components/IconPickerModal";
import { Segmented } from "@/components/Segmented";
import { getThemeChoice, setThemeChoice, THEME_OPTIONS, type ThemeChoice } from "@/lib/themePref";
import { listMembers, memberLabel, type Member } from "@/lib/members";
import { syncMyProfile } from "@/lib/profiles";
import {
  setHogarIcon,
  setPerfilIcon,
  HOGAR_ICONS,
  PERFIL_ICONS,
  type IconStyle,
} from "@/lib/appearance";
import { useHogarIcon, usePerfilIcon, useRefreshAppearance } from "@/lib/useAppearance";
import { useTheme } from "@/theme/theme";

export default function Perfil() {
  const t = useTheme();
  const router = useRouter();
  const { user, logout, updateName } = useAuth();
  const { active, leaveHogar } = useHogar();
  const [inviteOpen, setInviteOpen] = useState(false);
  const hogarIcon = useHogarIcon(active?.$id, t.accent).data ?? { icon: "home" as const, color: t.accent };
  const perfilIcon = usePerfilIcon(t.accent).data ?? null;
  const refreshAppearance = useRefreshAppearance();
  const [pick, setPick] = useState<"hogar" | "perfil" | null>(null);
  const [theme, setTheme] = useState<ThemeChoice>("system");
  const [members, setMembers] = useState<Member[] | null>(null);
  const [editName, setEditName] = useState<string | null>(null);

  useEffect(() => {
    getThemeChoice().then(setTheme).catch(() => undefined);
  }, []);

  // Quién más está en el hogar.
  useEffect(() => {
    if (!active) return;
    listMembers(active.$id).then(setMembers).catch(() => setMembers([]));
  }, [active]);

  const saveName = async () => {
    const val = (editName ?? "").trim();
    if (!val) return;
    try {
      await updateName(val);
      setEditName(null);
      if (active && user) {
        await syncMyProfile(active.$id, user.$id, val);
        listMembers(active.$id).then(setMembers).catch(() => undefined);
      }
    } catch (e) {
      Alert.alert("No se pudo cambiar el nombre", e instanceof Error ? e.message : "Inténtalo de nuevo.");
    }
  };

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
          <Text className="text-callout" style={{ color: t.accent }}>Inicio</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="px-4 pt-1 pb-3">
          <Text className="text-largeTitle font-bold tracking-tight text-label" style={{ lineHeight: 41 }}>
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
            {editName !== null ? (
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <TextInput
                  autoFocus
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Tu nombre"
                  placeholderTextColor={t.labelTertiary}
                  className="flex-1 bg-bg rounded-lg2 px-3 py-2 text-callout text-label"
                  onSubmitEditing={saveName}
                  returnKeyType="done"
                />
                <Pressable onPress={saveName} hitSlop={8}>
                  <Ionicons name="checkmark-circle" size={26} color={t.green} />
                </Pressable>
                <Pressable onPress={() => setEditName(null)} hitSlop={8}>
                  <Ionicons name="close-circle" size={26} color={t.labelTertiary} />
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={() => setEditName(user?.name || "")} className="flex-row items-center" style={{ gap: 6 }}>
                <Text className="text-headline font-semibold text-label">{user?.name || "Sin nombre"}</Text>
                <Ionicons name="pencil" size={13} color={t.accent} />
              </Pressable>
            )}
            <Text className="text-footnote text-secondary mt-0.5">{user?.email}</Text>
          </View>
        </View>

        {/* Hogar */}
        {active && (
          <>
            <SectionTitle>Tu hogar</SectionTitle>
            <ListGroup>
              <Row
                first
                leading={<RowIcon icon={hogarIcon.icon} color={hogarIcon.color} />}
                title={active.name}
                subtitle={`${active.total} ${active.total === 1 ? "miembro" : "miembros"}`}
                trailing={<Text className="text-footnote" style={{ color: t.accent }}>Cambiar icono</Text>}
                onPress={() => setPick("hogar")}
              />
              {(members ?? []).map((m) => {
                const isMe = m.email && user?.email ? m.email === user.email : m.name === user?.name;
                return (
                  <Row
                    key={m.id}
                    leading={
                      m.icon && m.iconColor ? (
                        <View
                          className="items-center justify-center"
                          style={{ width: 29, height: 29, borderRadius: 15, backgroundColor: m.iconColor }}
                        >
                          <Ionicons name={m.icon as IoniconName} size={15} color="#fff" />
                        </View>
                      ) : (
                        <Avatar name={memberLabel(m)} size={29} />
                      )
                    }
                    title={
                      <Text className="text-body text-label" numberOfLines={1}>
                        {memberLabel(m)}
                        {isMe ? <Text className="text-secondary"> · tú</Text> : null}
                      </Text>
                    }
                    subtitle={
                      m.email ? (
                        <Text className="text-footnote text-secondary mt-0.5" numberOfLines={1}>{m.email}</Text>
                      ) : !m.name ? (
                        // Appwrite no nos deja leer su nombre: solo aparece cuando esa
                        // persona abre la app y publica su ficha en el hogar.
                        <Text className="text-footnote mt-0.5" style={{ color: t.orange }}>
                          Aún no ha abierto esta versión
                        </Text>
                      ) : null
                    }
                    trailing={
                      !m.confirmed ? (
                        <Text className="text-caption1 font-medium" style={{ color: t.orange }}>pendiente</Text>
                      ) : undefined
                    }
                  />
                );
              })}
              <Row
                leading={<RowIcon icon="person-add" color={t.green} />}
                title="Invitar a alguien"
                chevron
                onPress={() => setInviteOpen(true)}
              />
              <Row
                leading={<RowIcon icon="exit-outline" color={t.red} />}
                title="Salir del hogar"
                destructive
                chevron
                onPress={confirmLeave}
              />
            </ListGroup>
          </>
        )}

        {/* Apariencia */}
        <SectionTitle>Apariencia</SectionTitle>
        <Segmented
          value={theme}
          onChange={(k) => {
            setTheme(k);
            setThemeChoice(k).catch(() => undefined);
          }}
          options={THEME_OPTIONS}
        />
        <Text className="px-4 pb-3 text-caption1 text-tertiary">
          “Claro” deja siempre los colores del diseño original (verde {"#1F4D52"}); en oscuro el
          acento se aclara para que se lea bien.
        </Text>

        {/* Sesión */}
        <SectionTitle>Cuenta</SectionTitle>
        <ListGroup>
          <Row
            first
            leading={<RowIcon icon="log-out-outline" color={t.gray} />}
            title="Cerrar sesión"
            destructive
            chevron
            onPress={confirmLogout}
          />
        </ListGroup>

        <Text className="text-center text-caption1 text-tertiary mt-4">
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
          await refreshAppearance();
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
          // Se republica en el hogar para que los demás vean el icono nuevo.
          if (active && user) {
            await syncMyProfile(active.$id, user.$id, user.name || "", { icon: st.icon, iconColor: st.color });
          }
          await refreshAppearance();
        }}
        onReset={async () => {
          await setPerfilIcon(null);
          if (active && user) {
            await syncMyProfile(active.$id, user.$id, user.name || "", { icon: null, iconColor: null });
          }
          await refreshAppearance();
        }}
      />
    </SafeAreaView>
  );
}
