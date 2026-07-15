import { useEffect, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/theme/theme";
import { Toggle } from "@/components/Toggle";
import { appliances } from "@/lib/samplePrices";
import { cheapestOptions, fmtEur, fmtKwh, priciestWindow, rangeLabel } from "@/lib/luz";
import { applianceReminder } from "@/lib/luzAlerts";
import { ensureNotificationPermissions, getToggle, scheduleAt } from "@/lib/notifications";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

export function Planner({
  visible,
  initialId,
  today,
  tomorrow,
  onClose,
}: {
  visible: boolean;
  initialId: string;
  today: number[];
  tomorrow: number[] | null;
  onClose: () => void;
}) {
  const t = useTheme();
  const [selId, setSelId] = useState(initialId);
  const [optIdx, setOptIdx] = useState(0);
  const [notify, setNotify] = useState(true);

  useEffect(() => {
    if (visible) {
      setSelId(initialId);
      setOptIdx(0);
      getToggle("reminder", true).then(setNotify);
    }
  }, [visible, initialId]);

  const a = appliances.find((x) => x.id === selId) ?? appliances[0];
  const nowHour = new Date().getHours();
  const opts = cheapestOptions(a, today, tomorrow, nowHour, 3);
  const safeIdx = optIdx >= opts.length ? 0 : optIdx;

  const confirm = async () => {
    const o = opts[safeIdx];
    onClose();
    if (!o) return;
    const when = `${a.name}: ${o.day.toLowerCase()} · ${rangeLabel(o.start, a.dur)}.`;
    if (!notify) {
      Alert.alert("Anotado", when);
      return;
    }
    try {
      const granted = await ensureNotificationPermissions();
      if (!granted) {
        Alert.alert("Sin permiso de notificaciones", "Actívalo en los ajustes del sistema para recibir el aviso.");
        return;
      }
      const plan = applianceReminder(o.day, o.start, a.name, o.avg, a.dur, new Date());
      if (!plan) {
        Alert.alert("Franja demasiado próxima", when + " Empieza ya mismo, ¡aprovecha!");
        return;
      }
      await scheduleAt(plan.date, plan.title, plan.body);
      const z = (n: number) => String(n).padStart(2, "0");
      Alert.alert(
        "Aviso programado 🔔",
        `${when}\nTe avisaremos a las ${z(plan.date.getHours())}:${z(plan.date.getMinutes())}.`,
      );
    } catch (e) {
      Alert.alert("No se pudo programar", e instanceof Error ? e.message : "Inténtalo de nuevo.");
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1" style={{ backgroundColor: t.overlay }} onPress={onClose} />
      <View className="rounded-t-[14px] absolute left-0 right-0 bottom-0" style={{ maxHeight: "85%", backgroundColor: t.bg }}>
        <View className="items-center pt-2 pb-1">
          <View style={{ width: 36, height: 5, borderRadius: 999, backgroundColor: t.separator }} />
        </View>
        <View className="flex-row items-center justify-between px-5 py-3" style={{ borderBottomWidth: 0.5, borderBottomColor: t.separator }}>
          <Pressable onPress={onClose}>
            <Text className="text-base text-accent">Cancelar</Text>
          </Pressable>
          <Text className="text-[17px] font-semibold text-label">Programar consumo</Text>
          <Pressable onPress={confirm}>
            <Text className="text-base font-semibold text-accent">Listo</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 28 }}>
          <Text className="px-5 pt-3 pb-2 text-xs font-medium uppercase tracking-wide text-secondary">
            ¿Qué quieres poner?
          </Text>
          <View className="flex-row flex-wrap px-3">
            {appliances.map((ap) => {
              const on = ap.id === selId;
              return (
                <View key={ap.id} style={{ width: "33.33%", padding: 4 }}>
                  <Pressable
                    onPress={() => {
                      setSelId(ap.id);
                      setOptIdx(0);
                    }}
                    className="bg-card rounded-lg2 items-center py-3"
                    style={{ borderWidth: 1.5, borderColor: on ? t.accent : "transparent" }}
                  >
                    <View
                      className="rounded-[9px] items-center justify-center"
                      style={{ width: 36, height: 36, backgroundColor: ap.color }}
                    >
                      <Ionicons name={ap.icon as IoniconName} size={20} color="#fff" />
                    </View>
                    <Text className="text-[13px] mt-2 text-label">{ap.name}</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>

          <Text className="px-5 pt-4 pb-2 text-xs font-medium uppercase tracking-wide text-secondary">
            Mejores horas para ponerlo
          </Text>
          <Text className="px-5 pb-2 text-[13px] text-secondary">
            {a.name} · {a.dur} h · {a.kwh.toFixed(1).replace(".", ",")} kWh por ciclo
          </Text>
          {opts.map((o, i) => {
            const arr = o.day === "Hoy" ? today : (tomorrow as number[]);
            const peak = priciestWindow(arr, a.dur)!;
            const cost = a.kwh * o.avg;
            const save = a.kwh * (peak.avg - o.avg);
            const on = i === safeIdx;
            return (
              <Pressable
                key={i}
                onPress={() => setOptIdx(i)}
                className="flex-row items-center bg-card rounded-[12px] mx-4 mb-2 px-3.5 py-3"
                style={{ borderWidth: 1.5, borderColor: on ? t.accent : "transparent" }}
              >
                <View
                  className="rounded-pill items-center justify-center mr-3"
                  style={{ width: 26, height: 26, backgroundColor: on ? t.accent : t.fill }}
                >
                  <Text style={{ color: on ? "#fff" : t.labelSecondary, fontWeight: "700", fontSize: 13 }}>
                    {i + 1}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-base font-semibold text-label">
                    {o.day} · {rangeLabel(o.start, a.dur)}
                  </Text>
                  <Text className="text-xs text-secondary mt-0.5">
                    ~{fmtEur(cost)} · ahorras {fmtEur(save)}
                  </Text>
                </View>
                <Text className="text-sm font-bold text-accent">{fmtKwh(o.avg)} €/kWh</Text>
              </Pressable>
            );
          })}

          <View className="flex-row items-center bg-card rounded-lg2 mx-4 mt-2 px-4 py-3" style={{ gap: 12 }}>
            <Text className="flex-1 text-[14px] text-label">Avisarme 10 min antes de empezar</Text>
            <Toggle value={notify} onChange={setNotify} />
          </View>

          <Pressable onPress={confirm} className="bg-accent rounded-[14px] mx-4 mt-4 py-3.5">
            <Text className="text-center text-white text-base font-semibold">Programar aviso</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}
