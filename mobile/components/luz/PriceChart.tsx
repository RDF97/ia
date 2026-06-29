import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { colors } from "@/theme/tokens";
import { fmtKwh, rangeLabel, tierOf, type Tier } from "@/lib/luz";

const tierColor = (t: Tier) =>
  t === "ok" ? colors.green : t === "mid" ? colors.orange : colors.red;
const tierText = (t: Tier) => (t === "ok" ? "Barato" : t === "mid" ? "Medio" : "Caro");

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View className="flex-row items-center" style={{ gap: 5 }}>
      <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: color }} />
      <Text className="text-xs text-neutral-500">{label}</Text>
    </View>
  );
}

export function PriceChart({ prices, isToday }: { prices: number[]; isToday: boolean }) {
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const nowHour = new Date().getHours();
  const defaultSel = isToday ? nowHour : prices.indexOf(min);
  const [sel, setSel] = useState(defaultSel);
  useEffect(() => setSel(defaultSel), [defaultSel]);

  const tier = tierOf(prices[sel], min, max);

  return (
    <View className="bg-white rounded-card mx-4 mb-3 p-4">
      {/* Lectura grande de la hora seleccionada */}
      <View className="flex-row items-center justify-between border-b border-neutral-200 pb-3 mb-3">
        <Text className="text-[15px] font-semibold text-neutral-500">{rangeLabel(sel, 1)}</Text>
        <View className="flex-row items-center" style={{ gap: 10 }}>
          <Text className="text-[22px] font-bold text-black" style={{ lineHeight: 27 }}>
            {fmtKwh(prices[sel])} €/kWh
          </Text>
          <Text
            className="text-xs font-bold text-white rounded-pill px-2.5 py-1"
            style={{ backgroundColor: tierColor(tier) }}
          >
            {tierText(tier)}
          </Text>
        </View>
      </View>

      {/* Barras por hora */}
      <View className="flex-row items-end" style={{ height: 130, gap: 2 }}>
        {prices.map((p, h) => {
          const t = tierOf(p, min, max);
          const heightPct = Math.max(6, Math.round((p / max) * 100));
          const isNow = isToday && h === nowHour;
          const selected = h === sel;
          return (
            <Pressable
              key={h}
              onPress={() => setSel(h)}
              className="flex-1 items-center justify-end"
              style={{ height: "100%" }}
            >
              <View
                style={{
                  width: "100%",
                  height: `${heightPct}%`,
                  backgroundColor: tierColor(t),
                  borderRadius: 3,
                  borderWidth: selected || isNow ? 2 : 0,
                  borderColor: selected ? colors.accent : colors.label,
                }}
              />
            </Pressable>
          );
        })}
      </View>
      <View className="flex-row justify-between mt-2">
        {["00", "06", "12", "18", "23"].map((l) => (
          <Text key={l} className="text-[10px] text-neutral-400">
            {l}
          </Text>
        ))}
      </View>

      <View className="flex-row justify-center mt-3" style={{ gap: 16 }}>
        <Legend color={colors.green} label="Barato" />
        <Legend color={colors.orange} label="Medio" />
        <Legend color={colors.red} label="Caro" />
      </View>
    </View>
  );
}
