import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import { listMembersDetailed, memberLabel, type Member } from "@/lib/members";
import { setProfileName, syncMyProfile } from "@/lib/profiles";
import { retryProfileSync, useProfileSyncError } from "@/lib/useProfileSync";
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
  const qc = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const hogarIcon = useHogarIcon(active?.$id, t.accent).data ?? { icon: "home" as const, color: t.accent };
  const perfilIcon = usePerfilIcon(t.accent).data ?? null;
  const refreshAppearance = useRefreshAppearance();
  // Si tu ficha no se pudo publicar, TODOS salen sin nombre. Hay que decirlo.
  const syncError = useProfileSyncError();
  const [pick, setPick] = useState<"hogar" | "perfil" | null>(null);
  const [theme, setTheme] = useState<ThemeChoice>("system");
  const [members, setMembers] = useState<Member[] | null>(null);
  // Lo que falló al LEER las fichas. Va aparte del fallo al escribirlas:
  // escribir bien y no poder leer es justo el caso que nos tuvo a ciegas.
  const [readError, setReadError] = useState<string | null>(null);
  const [editName, setEditName] = useState<string | null>(null);
  // Miembro al que le estoy poniendo el nombre yo (userId → texto escrito).
  const [naming, setNaming] = useState<{ userId: string; text: string } | null>(null);

  useEffect(() => {
    getThemeChoice().then(setTheme).catch(() => undefined);
  }, []);

  // Quién más está en el hogar.
  const reloadMembers = useCallback(() => {
    if (!active) return;
    listMembersDetailed(active.$id)
      .then(({ members: ms, profilesError }) => {
        setMembers(ms);
        setReadError(profilesError);
      })
      .catch(() => setMembers([]));
  }, [active]);

  useEffect(reloadMembers, [reloadMembers]);

  /**
   * Guarda el nombre que le pongo yo a otra persona del hogar. Su ficha queda
   * con permisos del hogar, así que ella lo puede corregir luego desde su móvil.
   */
  const saveMemberName = async (userId: string, text: string) => {
    const val = text.trim();
    if (!val || !active) return;
    const res = await setProfileName(active.$id, userId, val);
    if (!res.ok) {
      Alert.alert("No se pudo guardar", res.error);
      return;
    }
    setNaming(null);
    // Recarga aquí y no en otro sitio: la lista de miembros es lo que alimenta
    // los repartos de gastos y a quién se puede asignar una tarea.
    qc.invalidateQueries({ queryKey: ["members", active.$id] });
    reloadMembers();
  };

  const saveName = async () => {
    const val = (editName ?? "").trim();
    if (!val) return;
    try {
      await updateName(val);
      setEditName(null);
      if (active && user) {
        await syncMyProfile(active.$id, user.$id, val);
        reloadMembers();
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
            {(syncError || readError) && (
              <View
                className="mx-4 mb-3 rounded-lg2 px-4 py-3 flex-row"
                style={{ gap: 10, backgroundColor: t.orange + "1F" }}
              >
                <Ionicons name="warning-outline" size={19} color={t.orange} />
                <View className="flex-1">
                  <Text className="text-subhead font-semibold" style={{ color: t.orange }}>
                    {syncError ? "Los nombres del hogar no se están guardando" : "Los nombres están guardados pero no se pueden leer"}
                  </Text>
                  <Text className="text-caption1 text-secondary mt-1">{syncError ?? readError}</Text>
                  <Text className="text-caption1 text-tertiary mt-1">
                    Hasta que se arregle, todos os veréis como “Miembro sin nombre” y no se podrá
                    asignar tareas ni repartir gastos entre vosotros.
                  </Text>
                  <Pressable
                    onPress={async () => {
                      if (!active || !user) return;
                      const res = await retryProfileSync(active.$id, user.$id, user.name || "", t.accent);
                      if (res.ok) {
                        reloadMembers();
                        Alert.alert("Listo", "Tu nombre ya está publicado en el hogar.");
                      } else {
                        Alert.alert("Sigue sin poder guardarse", res.error);
                      }
                    }}
                    className="rounded-pill self-start mt-2 px-3 py-1.5"
                    style={{ backgroundColor: t.orange }}
                  >
                    <Text className="text-footnote font-semibold text-white">Reintentar</Text>
                  </Pressable>
                </View>
              </View>
            )}

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
                      ) : naming?.userId === m.userId ? (
                        <View className="flex-row items-center mt-1" style={{ gap: 8 }}>
                          <TextInput
                            autoFocus
                            value={naming.text}
                            onChangeText={(text) => setNaming({ userId: m.userId, text })}
                            placeholder="Su nombre"
                            placeholderTextColor={t.labelTertiary}
                            className="flex-1 bg-bg rounded-lg2 px-3 py-1.5 text-callout text-label"
                            onSubmitEditing={() => saveMemberName(m.userId, naming.text)}
                            returnKeyType="done"
                          />
                          <Pressable onPress={() => saveMemberName(m.userId, naming.text)} hitSlop={8}>
                            <Ionicons name="checkmark-circle" size={24} color={t.green} />
                          </Pressable>
                          <Pressable onPress={() => setNaming(null)} hitSlop={8}>
                            <Ionicons name="close-circle" size={24} color={t.labelTertiary} />
                          </Pressable>
                        </View>
                      ) : !m.name ? (
                        // Antes esto afirmaba "Aún no ha abierto esta versión", que muchas
                        // veces era mentira y además dejaba al usuario sin nada que hacer.
                        // Appwrite no deja leer el nombre de otra cuenta, pero quien está
                        // mirando la pantalla sabe perfectamente quién es: que lo escriba.
                        <Pressable onPress={() => setNaming({ userId: m.userId, text: "" })} hitSlop={6}>
                          <Text className="text-footnote mt-0.5" style={{ color: t.accent }}>
                            Appwrite no nos da su nombre · tocar para ponerlo
                          </Text>
                        </Pressable>
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
