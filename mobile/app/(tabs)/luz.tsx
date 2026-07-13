import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/theme/tokens";
import { useLuzPrices } from "@/lib/useLuzPrices";
import type { LuzSource } from "@/lib/luzData";
import { PriceChart } from "@/components/luz/PriceChart";
import { Planner } from "@/components/luz/Planner";
import { Segmented } from "@/components/Segmented";
import { Toggle } from "@/components/Toggle";
import { appliances } from "@/lib/samplePrices";
import {
  cheapStretches,
  cheapestWindow,
  dayPart,
  fmtEur,
  fmtKwh,
  hourLabel,
  priciestWindow,
  rangeLabel,
  tierOf,
} from "@/lib/luz";
import { cheapHourAlerts, expensiveStretchAlert } from "@/lib/luzAlerts";
import {
  cancelGroup,
  ensureNotificationPermissions,
  getToggle,
  saveGroupIds,
  scheduleAt,
  scheduleDaily,
  setToggle,
} from "@/lib/notifications";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

const sourceLabel = (s: LuzSource) =>
  s === "real" ? "PVPC · datos reales (REE)" : s === "pdl" ? "PVPC · datos reales" : "PVPC · datos de ejemplo";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Text className="px-5 pt-4 pb-2 text-[13px] font-medium uppercase tracking-wide text-neutral-500">
      {children}
    </Text>
  );
}

export default function Luz() {
  const { data, isLoading } = useLuzPrices();
  const [day, setDay] = useState<"today" | "tomorrow">("today");
  const [plannerId, setPlannerId] = useState<string | null>(null);

  if (!data) {
    return (
      <SafeAreaView className="flex-1 bg-bg-app items-center justify-center" edges={["top"]}>
        <ActivityIndicator color={colors.accent} />
        <Text className="text-neutral-500 mt-3">Cargando precios…</Text>
      </SafeAreaView>
    );
  }

  const { today, tomorrow, source } = data;
  const tomorrowAvailable = !!tomorrow;
  const dayPrices = day === "tomorrow" && tomorrow ? tomorrow : today;

  // Precio ahora (siempre hoy)
  const tMin = Math.min(...today);
  const tMax = Math.max(...today);
  const nowHour = new Date().getHours();
  const now = today[nowHour];
  const nowTier = tierOf(now, tMin, tMax);
  const nowColor = nowTier === "ok" ? colors.green : nowTier === "mid" ? colors.orange : colors.red;
  const nowLabel = nowTier === "ok" ? "Barato" : nowTier === "mid" ? "Precio medio" : "Caro";
  const avg = today.reduce((a: number, b: number) => a + b, 0) / today.length;
  const vs = Math.round(((now - avg) / avg) * 100);

  // Quick (del día mostrado)
  const dMin = Math.min(...dayPrices);
  const dMax = Math.max(...dayPrices);
  const stretches = cheapStretches(dayPrices);

  return (
    <SafeAreaView className="flex-1 bg-bg-app" edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="px-5 pt-2 pb-1">
          <Text className="text-[34px] font-bold tracking-tight text-black" style={{ lineHeight: 41 }}>
            Luz
          </Text>
          <Text className="text-[13px] text-neutral-500 mt-1">{sourceLabel(source)}</Text>
        </View>

        {/* Precio ahora */}
        <View className="rounded-card mx-4 mb-3 p-4" style={{ backgroundColor: nowColor }}>
          <View className="flex-row items-start justify-between">
            <View>
              <Text className="text-[11px] font-medium uppercase tracking-wide text-white/90">
                Precio ahora · {rangeLabel(nowHour, 1)}
              </Text>
              <Text className="text-[34px] font-bold text-white mt-1" style={{ lineHeight: 42, includeFontPadding: false }}>
                {fmtKwh(now)} <Text className="text-base text-white/90">€/kWh</Text>
              </Text>
            </View>
            <Text className="text-[13px] font-bold text-white rounded-pill px-3 py-1.5" style={{ backgroundColor: "#ffffff38" }}>
              {nowLabel}
            </Text>
          </View>
          <Text className="text-[13px] text-white/90 mt-3 pt-3 border-t border-white/20">
            {vs >= 0 ? "+" : ""}
            {vs}% vs media de hoy
          </Text>
        </View>

        {/* Más barata / más cara */}
        <View className="flex-row mx-4 mb-1" style={{ gap: 8 }}>
          <View className="flex-1 bg-white rounded-lg2 p-3">
            <Text className="text-[11px] uppercase tracking-wide text-neutral-500">Hora más barata</Text>
            <Text className="text-[20px] font-bold" style={{ color: colors.green }}>
              {hourLabel(dayPrices.indexOf(dMin))}
            </Text>
            <Text className="text-[13px]" style={{ color: colors.green }}>{fmtKwh(dMin)} €</Text>
          </View>
          <View className="flex-1 bg-white rounded-lg2 p-3">
            <Text className="text-[11px] uppercase tracking-wide text-neutral-500">Hora más cara</Text>
            <Text className="text-[20px] font-bold" style={{ color: colors.red }}>
              {hourLabel(dayPrices.indexOf(dMax))}
            </Text>
            <Text className="text-[13px]" style={{ color: colors.red }}>{fmtKwh(dMax)} €</Text>
          </View>
        </View>

        {/* Selector de día */}
        <View className="mt-3">
          <Segmented
            value={day}
            onChange={setDay}
            options={[
              { key: "today", label: "Hoy" },
              { key: "tomorrow", label: tomorrowAvailable ? "Mañana" : "Mañana · no publicado", disabled: !tomorrowAvailable },
            ]}
          />
        </View>

        <SectionTitle>Precio por horas · {day === "today" ? "Hoy" : "Mañana"}</SectionTitle>
        <PriceChart prices={dayPrices} isToday={day === "today"} />

        {/* Mejores tramos */}
        <SectionTitle>Mejores tramos para consumir</SectionTitle>
        <Text className="px-5 pb-2 text-[13px] text-neutral-500">
          Franjas seguidas con el precio por debajo de la media. Ideales para concentrar el consumo.
        </Text>
        <View className="bg-white rounded-lg2 mx-4 mb-3 overflow-hidden">
          {stretches.map((r, i) => (
            <View
              key={i}
              className="flex-row items-center px-4 py-3"
              style={{ borderTopWidth: i ? 0.5 : 0, borderTopColor: colors.separator }}
            >
              <View className="rounded-lg items-center justify-center mr-3" style={{ width: 32, height: 32, backgroundColor: colors.green }}>
                <Ionicons name="flash" size={16} color="#fff" />
              </View>
              <View className="flex-1">
                <Text className="text-base text-black">
                  {dayPart(r.start)} · {hourLabel(r.start)}–{hourLabel(r.end + 1)}
                </Text>
                <Text className="text-[13px] text-neutral-500 mt-0.5">
                  {r.n} {r.n === 1 ? "hora" : "horas"} baratas{i === 0 ? " · el más barato" : ""}
                </Text>
              </View>
              <Text className="text-[15px] font-semibold" style={{ color: colors.green }}>
                {fmtKwh(r.avg)} €/kWh
              </Text>
            </View>
          ))}
        </View>

        {/* Electrodomésticos */}
        <SectionTitle>Electrodomésticos</SectionTitle>
        <View className="flex-row flex-wrap px-3">
          {appliances.map((a) => {
            const best = cheapestWindow(dayPrices, a.dur)!;
            const peak = priciestWindow(dayPrices, a.dur)!;
            const cost = a.kwh * best.avg;
            const save = a.kwh * (peak.avg - best.avg);
            return (
              <View key={a.id} style={{ width: "50%", padding: 4 }}>
                <Pressable onPress={() => setPlannerId(a.id)} className="bg-white rounded-lg2 p-3">
                  <View className="flex-row items-center" style={{ gap: 8 }}>
                    <View className="rounded-[7px] items-center justify-center" style={{ width: 26, height: 26, backgroundColor: a.color }}>
                      <Ionicons name={a.icon as IoniconName} size={15} color="#fff" />
                    </View>
                    <Text className="text-[14px] font-semibold">{a.name}</Text>
                  </View>
                  <Text className="text-[15px] font-bold mt-1.5" style={{ color: colors.accent }}>
                    {rangeLabel(best.start, a.dur)}
                  </Text>
                  <Text className="text-xs text-neutral-500 mt-0.5">
                    ~{fmtEur(cost)} · {a.kwh.toFixed(1).replace(".", ",")} kWh
                  </Text>
                  <Text className="text-xs font-semibold mt-0.5" style={{ color: colors.green }}>
                    Ahorras {fmtEur(save)}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>

        {/* Avisos */}
        <SectionTitle>Avisos automáticos</SectionTitle>
        <AlertsCard today={today} tomorrow={tomorrow} />
      </ScrollView>

      <Planner
        visible={plannerId !== null}
        initialId={plannerId ?? "lavadora"}
        today={today}
        tomorrow={tomorrow}
        onClose={() => setPlannerId(null)}
      />
    </SafeAreaView>
  );
}

function AlertRow({
  icon,
  color,
  label,
  value,
  onChange,
  first,
}: {
  icon: IoniconName;
  color: string;
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  first?: boolean;
}) {
  return (
    <View
      className="flex-row items-center px-3.5 py-2.5"
      style={{ gap: 12, borderTopWidth: first ? 0 : 0.5, borderTopColor: colors.separator }}
    >
      <View className="rounded-lg items-center justify-center" style={{ width: 28, height: 28, backgroundColor: color }}>
        <Ionicons name={icon} size={14} color="#fff" />
      </View>
      <Text className="flex-1 text-[14px]">{label}</Text>
      <Toggle value={value} onChange={onChange} />
    </View>
  );
}

function AlertsCard({ today, tomorrow }: { today: number[]; tomorrow: number[] | null }) {
  const [cheap, setCheap] = useState(false);
  const [reminder, setReminder] = useState(true);
  const [expensive, setExpensive] = useState(false);
  const [summary, setSummary] = useState(false);

  useEffect(() => {
    (async () => {
      setCheap(await getToggle("cheap", false));
      setReminder(await getToggle("reminder", true));
      setExpensive(await getToggle("expensive", false));
      setSummary(await getToggle("summary", false));
    })();
  }, []);

  const guard = async (): Promise<boolean> => {
    const ok = await ensureNotificationPermissions();
    if (!ok) Alert.alert("Sin permiso de notificaciones", "Actívalo en los ajustes del sistema.");
    return ok;
  };

  const onCheap = async (on: boolean) => {
    setCheap(on);
    await setToggle("cheap", on);
    await cancelGroup("cheap");
    if (!on) return;
    if (!(await guard())) return;
    const plans = cheapHourAlerts(today, tomorrow, new Date());
    const ids = (await Promise.all(plans.map((p) => scheduleAt(p.date, p.title, p.body)))).filter(
      (x): x is string => !!x,
    );
    await saveGroupIds("cheap", ids);
  };

  const onReminder = async (on: boolean) => {
    setReminder(on);
    await setToggle("reminder", on);
  };

  const onExpensive = async (on: boolean) => {
    setExpensive(on);
    await setToggle("expensive", on);
    await cancelGroup("expensive");
    if (!on) return;
    if (!(await guard())) return;
    const plan = expensiveStretchAlert(today, new Date());
    if (!plan) return;
    const id = await scheduleAt(plan.date, plan.title, plan.body);
    if (id) await saveGroupIds("expensive", [id]);
  };

  const onSummary = async (on: boolean) => {
    setSummary(on);
    await setToggle("summary", on);
    await cancelGroup("summary");
    if (!on) return;
    if (!(await guard())) return;
    const id = await scheduleDaily(
      20,
      30,
      "📊 Precios de mañana",
      "Ya está publicado el PVPC de mañana. Abre Homie y mira las mejores horas.",
    );
    await saveGroupIds("summary", [id]);
  };

  return (
    <View className="bg-white rounded-lg2 mx-4 mb-1">
      <AlertRow first icon="flash" color={colors.green} label="Avisar en la hora más barata" value={cheap} onChange={onCheap} />
      <AlertRow icon="time-outline" color={colors.orange} label="Recordatorio de electrodoméstico programado" value={reminder} onChange={onReminder} />
      <AlertRow icon="warning-outline" color={colors.red} label="Avisar de tramos caros" value={expensive} onChange={onExpensive} />
      <AlertRow icon="newspaper-outline" color={colors.blue} label="Resumen de precios de mañana (20:30)" value={summary} onChange={onSummary} />
    </View>
  );
}
