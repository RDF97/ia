import { Alert, Pressable, Text, View } from "react-native";
import { Avatar, Money } from "@/components/ui";
import { useTheme } from "@/theme/theme";
import { recordSettlement } from "@/lib/settlements";

const eur = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;

/**
 * Tarjeta "quién debe a quién" con botón Liquidar (como el mockup). `net` es el
 * balance de la persona `name` desde el punto de vista del hogar: net < 0 → esa
 * persona debe (te debe); net > 0 → le deben (le debes tú). Liquidar registra el
 * pago que salda la deuda.
 */
export function DebtCard({
  hogarId,
  userName,
  name,
  net,
  onDone,
}: {
  hogarId: string;
  userName: string;
  name: string;
  net: number;
  onDone: () => void;
}) {
  const t = useTheme();
  const owesYou = net < 0;
  const amount = Math.abs(Math.round(net * 100) / 100);

  const liquidar = () => {
    const from = owesYou ? name : userName; // quien paga
    const to = owesYou ? userName : name; // quien cobra
    Alert.alert(
      "Liquidar deuda",
      owesYou
        ? `¿Marcar como pagado? ${name} te ha dado ${eur(amount)}.`
        : `¿Marcar como pagado? Le has dado ${eur(amount)} a ${name}.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Liquidar",
          onPress: async () => {
            try {
              await recordSettlement(hogarId, from, to, amount);
              onDone();
            } catch (e) {
              Alert.alert("No se pudo liquidar", e instanceof Error ? e.message : "Inténtalo de nuevo.");
            }
          },
        },
      ],
    );
  };

  return (
    <View className="rounded-card mx-4 mb-3 px-4 py-3.5 flex-row items-center" style={{ backgroundColor: t.accentSoft, gap: 12 }}>
      <Avatar name={name} size={38} />
      <View className="flex-1">
        <Text className="text-[15px] text-label">
          {owesYou ? `${name} te debe ` : `Debes a ${name} `}
          <Money size={15} weight="700" color={owesYou ? t.accent : t.red}>{eur(amount)}</Money>
        </Text>
        <Text className="text-[12px] text-secondary mt-0.5">Gastos compartidos</Text>
      </View>
      <Pressable onPress={liquidar} className="rounded-pill px-4 py-2" style={{ backgroundColor: t.accent }}>
        <Text className="text-white text-[14px] font-semibold">Liquidar</Text>
      </Pressable>
    </View>
  );
}
