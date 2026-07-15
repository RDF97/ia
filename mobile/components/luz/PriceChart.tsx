import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "@/theme/theme";
import { cardShadow } from "@/components/Card";
import { hSelect } from "@/lib/haptics";
import { fmtKwh, rangeLabel, tierOf, type Tier } from "@/lib/luz";

const tierColor = (t: Tier) => (t === "ok" ? "#34C759" : t === "mid" ? "#FF9500" : "#FF3B30");
const tierText = (t: Tier) => (t === "ok" ? "Barato" : t === "mid" ? "Medio" : "Caro");

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View className="flex-row items-center" style={{ gap: 5 }}>
      <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: color }} />
      <Text className="text-xs text-secondary">{label}</Text>
    </View>
  );
}

export function PriceChart({ prices, isToday }: { prices: number[]; isToday: boolean }) {
  const theme = useTheme();
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const nowHour = new Date().getHours();
  const defaultSel = isToday ? nowHour : prices.indexOf(min);
  const [sel, setSel] = useState(defaultSel);
  useEffect(() => setSel(defaultSel), [defaultSel]);

  const tier = tierOf(prices[sel], min, max);

  return (
    <View className="bg-card rounded-card mx-4 mb-3 p-4" style={cardShadow(theme.dark)}>
      <View className="flex-row items-center justify-between pb-3 mb-3" style={{ borderBottomWidth: 0.5, borderBottomColor: theme.separator }}>
        <Text className="text-[15px] font-semibold text-secondary">{rangeLabel(sel, 1)}</Text>
        <View className="flex-row items-center" style={{ gap: 10 }}>
          <Text className="text-[22px] font-bold text-label" style={{ lineHeight: 27, fontVariant: ["tabular-nums"] }}>
            {fmtKwh(prices[sel])} €/kWh
          </Text>
          <Text className="text-xs font-bold text-white rounded-pill px-2.5 py-1" style={{ backgroundColor: tierColor(tier) }}>
            {tierText(tier)}
          </Text>
        </View>
      </View>

      <View className="flex-row items-end" style={{ height: 130, gap: 2 }}>
        {prices.map((p, h) => {
          const bt = tierOf(p, min, max);
          const heightPct = Math.max(6, Math.round((p / max) * 100));
          const isNow = isToday && h === nowHour;
          const selected = h === sel;
          return (
            <Pressable
              key={h}
              onPress={() => {
                hSelect();
                setSel(h);
              }}
              className="flex-1 items-center justify-end"
              style={{ height: "100%" }}
            >
              <View
                style={{
                  width: "100%",
                  height: `${heightPct}%`,
                  backgroundColor: tierColor(bt),
                  borderRadius: 3,
                  borderWidth: selected || isNow ? 2 : 0,
                  borderColor: selected ? theme.accent : theme.label,
                }}
              />
            </Pressable>
          );
        })}
      </View>
      <View className="flex-row justify-between mt-2">
        {["00", "06", "12", "18", "23"].map((l) => (
          <Text key={l} className="text-[10px] text-tertiary">
            {l}
          </Text>
        ))}
      </View>

      <View className="flex-row justify-center mt-3" style={{ gap: 16 }}>
        <Legend color="#34C759" label="Barato" />
        <Legend color="#FF9500" label="Medio" />
        <Legend color="#FF3B30" label="Caro" />
      </View>
    </View>
  );
}
