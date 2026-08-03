import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/theme/theme";
import { cardShadow } from "@/components/Card";
import { fmtKwh, tierOf } from "@/lib/luz";

const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00`;

/** Las 24 horas en lista, ordenadas por hora, con su color de tramo. */
export function PriceList({ prices, isToday }: { prices: number[]; isToday: boolean }) {
  const t = useTheme();
  if (!prices.length) return null;

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const cheapest = prices.indexOf(min);
  const dearest = prices.indexOf(max);
  const nowHour = new Date().getHours();

  const colorOf = (v: number) => {
    const tier = tierOf(v, min, max);
    return tier === "ok" ? t.green : tier === "mid" ? t.orange : t.red;
  };

  return (
    <View className="bg-card rounded-lg2 mx-4 mb-3 overflow-hidden" style={cardShadow(t.dark)}>
      {prices.map((v, h) => {
        const isNow = isToday && h === nowHour;
        const color = colorOf(v);
        return (
          <View
            key={h}
            className="flex-row items-center px-4 py-2.5"
            style={{
              gap: 12,
              borderTopWidth: h ? 0.5 : 0,
              borderTopColor: t.separator,
              backgroundColor: isNow ? (t.dark ? "rgba(63,165,173,0.16)" : "rgba(31,77,82,0.07)") : undefined,
            }}
          >
            <Text
              className="text-subhead"
              style={{
                width: 52,
                color: isNow ? t.accent : t.labelSecondary,
                fontWeight: isNow ? "700" : "500",
                fontVariant: ["tabular-nums"],
              }}
            >
              {hourLabel(h)}
            </Text>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
            <View className="flex-1 flex-row items-center" style={{ gap: 6 }}>
              {h === cheapest && <Ionicons name="trophy" size={13} color={t.green} />}
              {h === dearest && <Ionicons name="warning" size={13} color={t.red} />}
              {isNow && <Text className="text-caption1 font-semibold" style={{ color: t.accent }}>ahora</Text>}
            </View>
            <Text
              className="text-subhead font-semibold"
              style={{ color, fontVariant: ["tabular-nums"] }}
            >
              {fmtKwh(v)} €
            </Text>
          </View>
        );
      })}
    </View>
  );
}
