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
import { useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Card, PhaseCard } from "@/components/Card";
import { useAuth } from "@/lib/auth";
import { useHogar } from "@/lib/hogar";
import { appwriteConfigured } from "@/lib/appwrite";
import { useExpenses } from "@/lib/useExpenses";
import { useTasks } from "@/lib/useTasks";
import { useShopping } from "@/lib/useShopping";
import { useEvents } from "@/lib/useEvents";
import { useLuzPrices } from "@/lib/useLuzPrices";
import { balances, monthlyTotal } from "@/lib/expenses";
import { eventsOfDay, hhmm } from "@/lib/events";
import { fmtKwh, tierOf } from "@/lib/luz";
import { colors } from "@/theme/tokens";

const eur = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;

export default function Inicio() {
  const { user, logout } = useAuth();
  const { active, invite } = useHogar();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  if (!appwriteConfigured || !active) {
    return (
      <Screen title="Hola 👋" subtitle="Casa compartida">
        <PhaseCard phase="Fase 6 · Inicio">
          Panel resumen del hogar. Se activa al configurar el backend y entrar en un hogar.
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
    <>
      <Dashboard
        hogarId={active.$id}
        members={active.total}
        hogarName={active.name}
        userName={user?.name || ""}
        onInvite={() => setInviteOpen(true)}
        onLogout={logout}
      />
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
            {busy ? <ActivityIndicator color="#fff" /> : <Text className="text-white text-base font-semibold">Enviar invitación</Text>}
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

function Tile({
  label,
  value,
  sub,
  color,
  onPress,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} className="flex-1 bg-white rounded-lg2 p-3" style={{ minHeight: 82 }}>
      <Text className="text-[11px] uppercase tracking-wide text-neutral-500 font-medium">{label}</Text>
      <Text className="text-[19px] font-bold mt-1" style={{ color: color ?? colors.label }}>{value}</Text>
      {sub ? <Text className="text-[11px] text-neutral-500 mt-0.5">{sub}</Text> : null}
    </Pressable>
  );
}

function Dashboard({
  hogarId,
  members,
  hogarName,
  userName,
  onInvite,
  onLogout,
}: {
  hogarId: string;
  members: number;
  hogarName: string;
  userName: string;
  onInvite: () => void;
  onLogout: () => void;
}) {
  const router = useRouter();
  const expenses = useExpenses(hogarId).data ?? [];
  const tasks = useTasks(hogarId).data ?? [];
  const shopping = useShopping(hogarId).data ?? [];
  const events = useEvents(hogarId).data ?? [];
  const luz = useLuzPrices().data;

  const total = monthlyTotal(expenses);
  const pendingTasks = tasks.filter((t) => !t.done).length;
  const pendingShop = shopping.filter((s) => !s.done).length;
  const bal = balances(expenses, members);
  const todayEvents = eventsOfDay(events, new Date());

  let luzValue = "—";
  let luzColor: string = colors.label;
  if (luz) {
    const min = Math.min(...luz.today);
    const max = Math.max(...luz.today);
    const now = luz.today[new Date().getHours()];
    const tier = tierOf(now, min, max);
    luzValue = `${fmtKwh(now)} €`;
    luzColor = tier === "ok" ? colors.green : tier === "mid" ? colors.orange : colors.red;
  }

  return (
    <Screen title={`Hola, ${userName} 👋`} subtitle={hogarName}>
      {/* Hogar + invitar */}
      <Card>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center" style={{ gap: 10 }}>
            <View className="rounded-lg2 items-center justify-center" style={{ width: 40, height: 40, backgroundColor: colors.accent }}>
              <Ionicons name="home" size={20} color="#fff" />
            </View>
            <View>
              <Text className="text-[16px] font-semibold text-black">{hogarName}</Text>
              <Text className="text-[13px] text-neutral-500">
                {members} {members === 1 ? "miembro" : "miembros"}
              </Text>
            </View>
          </View>
          <Pressable onPress={onInvite} className="rounded-pill px-3 py-2 flex-row items-center" style={{ backgroundColor: colors.accent, gap: 6 }}>
            <Ionicons name="person-add-outline" size={15} color="#fff" />
            <Text className="text-white text-[13px] font-semibold">Invitar</Text>
          </Pressable>
        </View>
      </Card>

      {/* Tiles resumen */}
      <View className="flex-row mx-4 mb-3" style={{ gap: 8 }}>
        <Tile label="Gastos mes" value={eur(total)} onPress={() => router.navigate("/gastos")} />
        <Tile label="Tareas" value={String(pendingTasks)} sub="pendientes" onPress={() => router.navigate("/tareas")} />
        <Tile label="Luz ahora" value={luzValue} color={luzColor} sub="€/kWh" onPress={() => router.navigate("/luz")} />
      </View>

      {/* Hoy (agenda) */}
      <Text className="px-5 pt-1 pb-2 text-[13px] font-medium uppercase tracking-wide text-neutral-500">Hoy</Text>
      <View className="bg-white rounded-lg2 mx-4 mb-3 overflow-hidden">
        {todayEvents.length === 0 ? (
          <Pressable onPress={() => router.navigate("/calendario")} className="px-4 py-4">
            <Text className="text-neutral-400">Sin eventos hoy · toca para añadir</Text>
          </Pressable>
        ) : (
          todayEvents.map((e, i) => (
            <Pressable
              key={e.$id}
              onPress={() => router.navigate("/calendario")}
              className="flex-row items-center px-4 py-3"
              style={{ gap: 12, borderTopWidth: i ? 0.5 : 0, borderTopColor: colors.separator }}
            >
              <Text className="text-[14px] font-semibold text-neutral-500" style={{ width: 48 }}>{hhmm(e.startAt)}</Text>
              <View style={{ width: 3, height: 30, borderRadius: 2, backgroundColor: colors.accent }} />
              <View className="flex-1">
                <Text className="text-[15px] font-medium text-black">{e.title}</Text>
                {e.place ? <Text className="text-[12px] text-neutral-500 mt-0.5">{e.place}</Text> : null}
              </View>
            </Pressable>
          ))
        )}
      </View>

      {/* Compra pendiente */}
      <Pressable onPress={() => router.navigate("/compra")}>
        <Card>
          <View className="flex-row items-center" style={{ gap: 12 }}>
            <View className="rounded-lg2 items-center justify-center" style={{ width: 36, height: 36, backgroundColor: "#8E8E93" }}>
              <Ionicons name="cart-outline" size={18} color="#fff" />
            </View>
            <Text className="flex-1 text-[15px] text-black">Compra pendiente</Text>
            <Text className="text-[15px] font-semibold" style={{ color: colors.accent }}>
              {pendingShop} {pendingShop === 1 ? "producto" : "productos"}
            </Text>
          </View>
        </Card>
      </Pressable>

      {/* Quién debe a quién */}
      {bal.length > 0 && (
        <>
          <Text className="px-5 pt-1 pb-2 text-[13px] font-medium uppercase tracking-wide text-neutral-500">Quién debe a quién</Text>
          <Card>
            {bal.map((b, i) => (
              <View key={b.name} className="flex-row items-center justify-between py-2" style={{ borderTopWidth: i ? 0.5 : 0, borderTopColor: colors.separator }}>
                <Text className="text-[15px] text-black">{b.name}</Text>
                <Text className="text-[15px] font-semibold" style={{ color: b.net >= 0 ? colors.green : colors.red }}>
                  {b.net >= 0 ? `le deben ${eur(b.net)}` : `debe ${eur(-b.net)}`}
                </Text>
              </View>
            ))}
          </Card>
        </>
      )}

      <Pressable onPress={onLogout} className="mt-1 items-center py-2">
        <Text className="text-[14px]" style={{ color: colors.accent }}>Cerrar sesión</Text>
      </Pressable>
    </Screen>
  );
}
