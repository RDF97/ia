import { Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { Card } from "@/components/Card";
import { colors } from "@/theme/tokens";
import {
  cheapestOptions,
  cheapestWindow,
  fmtKwh,
  hourLabel,
  rangeLabel,
  tierOf,
} from "@/lib/luz";
import { appliances, samplePrices } from "@/lib/samplePrices";

// Fase 1 (en construcción): primera versión funcional reutilizando la lógica ya
// validada del prototipo. Los datos se conectarán a ESIOS/REE vía backend.
export default function Luz() {
  const { today, tomorrow } = samplePrices;
  const min = Math.min(...today);
  const max = Math.max(...today);
  const nowHour = new Date().getHours();
  const now = today[nowHour];
  const tier = tierOf(now, min, max);
  const tierLabel = tier === "ok" ? "Barato" : tier === "mid" ? "Medio" : "Caro";
  const tierColor = tier === "ok" ? colors.green : tier === "mid" ? colors.orange : colors.red;
  const cheapest = cheapestWindow(today, 1)!;

  const lavadora = appliances.find((a) => a.id === "lavadora")!;
  const opts = cheapestOptions(lavadora, today, tomorrow, nowHour, 3);

  return (
    <Screen title="Luz" subtitle="PVPC · datos de ejemplo">
      <Card>
        <Text className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
          Precio ahora · {rangeLabel(nowHour, 1)}
        </Text>
        <View className="flex-row items-end justify-between mt-1">
          <Text className="text-[34px] font-bold tracking-tight text-black">
            {fmtKwh(now)} <Text className="text-base text-neutral-500">€/kWh</Text>
          </Text>
          <Text
            className="text-xs font-bold text-white rounded-pill px-3 py-1"
            style={{ backgroundColor: tierColor }}
          >
            {tierLabel}
          </Text>
        </View>
        <Text className="text-[13px] text-neutral-500 mt-2">
          Hora más barata: {hourLabel(cheapest.start)} ({fmtKwh(cheapest.avg)} €)
        </Text>
      </Card>

      <View className="px-5 pt-3 pb-1">
        <Text className="text-[13px] font-medium uppercase tracking-wide text-neutral-500">
          Mejor momento para la lavadora
        </Text>
      </View>
      {opts.map((o, i) => (
        <Card key={i}>
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-semibold text-black">
              {i + 1}. {o.day} · {rangeLabel(o.start, lavadora.dur)}
            </Text>
            <Text className="text-sm font-bold text-accent">{fmtKwh(o.avg)} €/kWh</Text>
          </View>
        </Card>
      ))}

      <View className="px-5 pt-2">
        <Text className="text-[12px] text-neutral-400">
          Fase 1 · gráfico por horas, planificador completo y avisos push en camino.
        </Text>
      </View>
    </Screen>
  );
}
