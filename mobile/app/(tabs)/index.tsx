import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Screen } from "@/components/Screen";
import { Card, PhaseCard } from "@/components/Card";
import { Avatar, IconTile, Money, SectionTitle } from "@/components/ui";
import { InviteModal } from "@/components/InviteModal";
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
  const { user } = useAuth();
  const { active } = useHogar();
  const [inviteOpen, setInviteOpen] = useState(false);

  if (!appwriteConfigured || !active) {
    return (
      <Screen title="Hola 👋" subtitle="Casa compartida">
        <PhaseCard phase="Fase 6 · Inicio">
          Panel resumen del hogar. Se activa al configurar el backend y entrar en un hogar.
        </PhaseCard>
      </Screen>
    );
  }

  return (
    <>
      <Dashboard
        hogarId={active.$id}
        members={active.total}
        hogarName={active.name}
        userName={user?.name || ""}
        onInvite={() => setInviteOpen(true)}
      />
      <InviteModal visible={inviteOpen} hogarName={active.name} onClose={() => setInviteOpen(false)} />
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
    <Pressable
      onPress={onPress}
      className="flex-1 bg-white p-3 justify-between"
      style={{ minHeight: 80, borderRadius: 14 }}
    >
      <Text
        className="text-[11px] text-neutral-500 font-medium"
        style={{ textTransform: "uppercase", letterSpacing: 0.4 }}
      >
        {label}
      </Text>
      <View>
        <Text
          className="text-[18px] font-semibold"
          style={{ color: color ?? colors.label, fontVariant: ["tabular-nums"], letterSpacing: -0.3 }}
        >
          {value}
        </Text>
        {sub ? <Text className="text-[11px] font-medium text-neutral-500 mt-0.5">{sub}</Text> : null}
      </View>
    </Pressable>
  );
}

function Dashboard({
  hogarId,
  members,
  hogarName,
  userName,
  onInvite,
}: {
  hogarId: string;
  members: number;
  hogarName: string;
  userName: string;
  onInvite: () => void;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const expenses = useExpenses(hogarId).data ?? [];
  const tasks = useTasks(hogarId).data ?? [];
  const shopping = useShopping(hogarId).data ?? [];
  const events = useEvents(hogarId).data ?? [];
  const luz = useLuzPrices().data;

  const refreshAll = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["expenses", hogarId] }),
      qc.invalidateQueries({ queryKey: ["tasks", hogarId] }),
      qc.invalidateQueries({ queryKey: ["shopping", hogarId] }),
      qc.invalidateQueries({ queryKey: ["events", hogarId] }),
      qc.invalidateQueries({ queryKey: ["luz-prices"] }),
    ]);

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
    <Screen
      title={`Hola, ${userName} 👋`}
      subtitle={hogarName}
      onRefresh={refreshAll}
      right={
        <Pressable onPress={() => router.push("/perfil")} style={{ marginBottom: 4 }} hitSlop={6}>
          <Avatar name={userName} size={38} />
        </Pressable>
      }
    >
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
      <SectionTitle>Hoy</SectionTitle>
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
            <IconTile icon="cart" color="#8E8E93" size={34} />
            <Text className="flex-1 text-[15px] text-black">Compra pendiente</Text>
            <Money size={15} color={colors.accent}>
              {pendingShop} {pendingShop === 1 ? "producto" : "productos"}
            </Money>
          </View>
        </Card>
      </Pressable>

      {/* Quién debe a quién — estilo .debt-card del mockup */}
      {bal.length > 0 && (
        <>
          <SectionTitle>Quién debe a quién</SectionTitle>
          <View className="rounded-card mx-4 mb-3 px-4 py-3" style={{ backgroundColor: colors.accentSoft }}>
            {bal.map((b, i) => (
              <View
                key={b.name}
                className="flex-row items-center py-2"
                style={{ gap: 12, borderTopWidth: i ? 0.5 : 0, borderTopColor: colors.separator }}
              >
                <Avatar name={b.name} size={32} />
                <View className="flex-1">
                  <Text className="text-[12px] text-neutral-500">{b.name}</Text>
                  <Money size={17} weight="700" color={b.net >= 0 ? colors.accent : colors.red}>
                    {b.net >= 0 ? `le deben ${eur(b.net)}` : `debe ${eur(-b.net)}`}
                  </Money>
                </View>
              </View>
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}
