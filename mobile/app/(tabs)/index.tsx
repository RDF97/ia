import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Screen } from "@/components/Screen";
import { Card, PhaseCard, cardShadow } from "@/components/Card";
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
import { balances, monthlyTotal, previousMonthTotal } from "@/lib/expenses";
import { eventsOfDay, hhmm } from "@/lib/events";
import { fmtKwh, tierOf } from "@/lib/luz";
import { useTheme, type Theme } from "@/theme/theme";

const eur = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;
const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** Color de la barra del evento según su dueño (azul/rosa/acento…), como el mockup. */
function stripeColor(t: Theme, name?: string | null): string {
  const palette = [t.blue, t.pink, t.accent, t.purple, t.teal];
  if (!name) return t.accent;
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

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
  trend,
  color,
  onPress,
}: {
  label: string;
  value: string;
  sub?: string;
  trend?: { text: string; dir: "up" | "down" };
  color?: string;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} className="flex-1 bg-card p-3 justify-between" style={{ minHeight: 80, borderRadius: 14, ...cardShadow(t.dark) }}>
      <Text className="text-[11px] text-secondary font-medium" style={{ textTransform: "uppercase", letterSpacing: 0.4 }}>
        {label}
      </Text>
      <View>
        <Text className="text-[18px] font-semibold" style={{ color: color ?? t.label, fontVariant: ["tabular-nums"], letterSpacing: -0.3 }}>
          {value}
        </Text>
        {trend ? (
          // Subir el gasto es "malo" → rojo; bajarlo → verde (como el mockup).
          <Text className="text-[11px] font-medium mt-0.5" style={{ color: trend.dir === "up" ? t.red : t.green }}>
            {trend.text}
          </Text>
        ) : sub ? (
          <Text className="text-[11px] font-medium text-secondary mt-0.5" numberOfLines={1}>{sub}</Text>
        ) : null}
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
  const t = useTheme();
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
  const prevTotal = previousMonthTotal(expenses);
  const pctChange = prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : null;
  const gastosTrend =
    pctChange !== null && pctChange !== 0
      ? { text: `${pctChange > 0 ? "+" : ""}${pctChange}% vs mes pasado`, dir: (pctChange > 0 ? "up" : "down") as "up" | "down" }
      : undefined;
  const pendingTasks = tasks.filter((x) => !x.done).length;
  const pendingShop = shopping.filter((s) => !s.done).length;
  const shopPreview = shopping.filter((s) => !s.done).slice(0, 3).map((s) => s.name).join(" · ");
  const shopStore = shopping.filter((s) => !s.done).find((s) => s.store)?.store ?? null;
  const bal = balances(expenses, members).filter((b) => b.name !== userName && Math.abs(b.net) >= 0.01);
  const now = new Date();
  const todayLabel = `${WEEKDAYS[now.getDay()]} ${now.getDate()}`;
  const todayEvents = eventsOfDay(events, now);

  const settleDebt = (name: string, amount: string, owesYou: boolean) =>
    Alert.alert(
      "Liquidar",
      owesYou
        ? `${name} te debe ${amount}. Cuando te lo pague, apúntalo en Gastos. (El registro automático de liquidaciones llegará pronto.)`
        : `Debes ${amount} a ${name}. Al pagarle, apúntalo en Gastos. (El registro automático de liquidaciones llegará pronto.)`,
      [{ text: "Entendido" }],
    );

  let luzValue = "—";
  let luzColor: string = t.label;
  if (luz) {
    const min = Math.min(...luz.today);
    const max = Math.max(...luz.today);
    const now = luz.today[new Date().getHours()];
    const tier = tierOf(now, min, max);
    luzValue = `${fmtKwh(now)} €`;
    luzColor = tier === "ok" ? t.green : tier === "mid" ? t.orange : t.red;
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
      <Card>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center" style={{ gap: 10 }}>
            <View className="rounded-lg2 items-center justify-center" style={{ width: 40, height: 40, backgroundColor: t.accent }}>
              <Ionicons name="home" size={20} color="#fff" />
            </View>
            <View>
              <Text className="text-[16px] font-semibold text-label">{hogarName}</Text>
              <Text className="text-[13px] text-secondary">
                {members} {members === 1 ? "miembro" : "miembros"}
              </Text>
            </View>
          </View>
          <Pressable onPress={onInvite} className="rounded-pill px-3 py-2 flex-row items-center" style={{ backgroundColor: t.accent, gap: 6 }}>
            <Ionicons name="person-add-outline" size={15} color="#fff" />
            <Text className="text-white text-[13px] font-semibold">Invitar</Text>
          </Pressable>
        </View>
      </Card>

      <View className="flex-row mx-4 mb-3" style={{ gap: 8 }}>
        <Tile label="Gastos mes" value={eur(total)} trend={gastosTrend} onPress={() => router.navigate("/gastos")} />
        <Tile label="Tareas" value={String(pendingTasks)} sub="pendientes" onPress={() => router.navigate("/tareas")} />
        <Tile label="Luz ahora" value={luzValue} color={luzColor} sub="€/kWh" onPress={() => router.navigate("/luz")} />
      </View>

      {/* Agenda de hoy (cabecera dentro de la tarjeta + barra de color por evento) */}
      <Card>
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-[17px] font-semibold text-label" style={{ letterSpacing: -0.2 }}>
            Hoy · {todayLabel}
          </Text>
          <Pressable onPress={() => router.navigate("/calendario")} hitSlop={6}>
            <Text className="text-[14px] font-medium text-accent">Ver todo</Text>
          </Pressable>
        </View>
        {todayEvents.length === 0 ? (
          <Pressable onPress={() => router.navigate("/calendario")} className="py-2">
            <Text className="text-tertiary">Sin eventos hoy · toca para añadir</Text>
          </Pressable>
        ) : (
          todayEvents.map((e, i) => (
            <Pressable
              key={e.$id}
              onPress={() => router.navigate("/calendario")}
              className="flex-row items-center py-2.5"
              style={{ gap: 12, borderTopWidth: i ? 0.5 : 0, borderTopColor: t.separator }}
            >
              <View style={{ width: 3, height: 32, borderRadius: 2, backgroundColor: stripeColor(t, e.ownerName) }} />
              <Text className="text-[13px] font-semibold text-secondary" style={{ width: 46, fontVariant: ["tabular-nums"] }}>{hhmm(e.startAt)}</Text>
              <View className="flex-1">
                <Text className="text-[15px] text-label">{e.title}</Text>
                <Text className="text-[12px] text-secondary mt-0.5" numberOfLines={1}>
                  {e.ownerName}{e.place ? ` · ${e.place}` : ""}
                </Text>
              </View>
            </Pressable>
          ))
        )}
      </Card>

      {/* Pendientes de compra */}
      <Pressable onPress={() => router.navigate("/compra")}>
        <Card>
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-[17px] font-semibold text-label" style={{ letterSpacing: -0.2 }}>Pendientes de compra</Text>
            <Text className="text-[14px] font-medium text-accent">Ver lista</Text>
          </View>
          <View className="flex-row items-center" style={{ gap: 12 }}>
            <IconTile icon="cart" color={t.gray} size={34} />
            <View className="flex-1">
              <Text className="text-[15px] text-label" numberOfLines={1}>
                {pendingShop > 0 ? shopPreview : "Lista al día"}
              </Text>
              <Text className="text-[12px] text-secondary mt-0.5">
                {pendingShop > 0
                  ? `${pendingShop} ${pendingShop === 1 ? "producto" : "productos"}${shopStore ? ` en ${shopStore}` : ""}`
                  : "Nada pendiente"}
              </Text>
            </View>
          </View>
        </Card>
      </Pressable>

      {/* Quién debe a quién (tarjeta con botón Liquidar, como el mockup) */}
      {bal.length > 0 && (
        <>
          <SectionTitle>Quién debe a quién</SectionTitle>
          {bal.map((b) => {
            const owesYou = b.net < 0; // net<0 → esa persona debe al bote (te debe)
            const amount = eur(Math.abs(b.net));
            return (
              <View key={b.name} className="rounded-card mx-4 mb-3 px-4 py-3.5 flex-row items-center" style={{ backgroundColor: t.accentSoft, gap: 12 }}>
                <Avatar name={b.name} size={38} />
                <View className="flex-1">
                  <Text className="text-[15px] text-label">
                    {owesYou ? `${b.name} te debe ` : `Debes a ${b.name} `}
                    <Money size={15} weight="700" color={owesYou ? t.accent : t.red}>{amount}</Money>
                  </Text>
                  <Text className="text-[12px] text-secondary mt-0.5">Gastos compartidos</Text>
                </View>
                <Pressable
                  onPress={() => settleDebt(b.name, amount, owesYou)}
                  className="rounded-pill px-4 py-2"
                  style={{ backgroundColor: t.accent }}
                >
                  <Text className="text-white text-[14px] font-semibold">Liquidar</Text>
                </Pressable>
              </View>
            );
          })}
        </>
      )}
    </Screen>
  );
}
