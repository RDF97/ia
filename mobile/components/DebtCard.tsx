import { useState } from "react";
import { Alert, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Avatar, Money } from "@/components/ui";
import { SheetHeader } from "@/components/SheetHeader";
import { useTheme } from "@/theme/theme";
import { recordSettlement } from "@/lib/settlements";
import { balanceDetail, type Expense, type SettlementLike } from "@/lib/expenses";

const eur = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;
const shortDate = (iso: string): string => {
  if (!iso) return "";
  const d = new Date(iso);
  return isFinite(d.getTime()) ? `${d.getDate()}/${d.getMonth() + 1}` : "";
};

/**
 * Tarjeta "quién debe a quién" con botón Liquidar (como el mockup). `net` es el
 * balance de la persona `name` desde el punto de vista del hogar: net < 0 → esa
 * persona debe (te debe); net > 0 → le deben (le debes tú). Liquidar registra el
 * pago que salda la deuda.
 *
 * Tocar la tarjeta abre el desglose: qué gastos forman la cifra. Un número sin
 * explicación no se puede comprobar, y una deuda que no sabes de dónde sale no
 * se paga con ganas.
 */
export function DebtCard({
  hogarId,
  userName,
  name,
  net,
  onDone,
  expenses,
  settlements,
  members,
  memberNames,
}: {
  hogarId: string;
  userName: string;
  name: string;
  net: number;
  onDone: () => void;
  /** Para el desglose. Si no se pasan, la tarjeta no es desplegable. */
  expenses?: Expense[];
  settlements?: SettlementLike[];
  members?: number;
  memberNames?: string[];
}) {
  const t = useTheme();
  const [openDetail, setOpenDetail] = useState(false);
  const owesYou = net < 0;
  const amount = Math.abs(Math.round(net * 100) / 100);
  const canExplain = !!expenses;

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

  const detail = canExplain
    ? balanceDetail(expenses ?? [], name, members ?? 0, settlements ?? [], memberNames ?? [])
    : null;

  return (
    <>
      <View className="rounded-card mx-4 mb-3 px-4 py-3.5 flex-row items-center" style={{ backgroundColor: t.accentSoft, gap: 12 }}>
        <Avatar name={name} size={38} />
        <Pressable className="flex-1" onPress={() => canExplain && setOpenDetail(true)} disabled={!canExplain}>
          <Text className="text-subhead text-label">
            {owesYou ? `${name} te debe ` : `Debes a ${name} `}
            <Money size={15} weight="700" color={owesYou ? t.accent : t.red}>{eur(amount)}</Money>
          </Text>
          <View className="flex-row items-center mt-0.5" style={{ gap: 3 }}>
            <Text className="text-caption1 text-secondary">
              {canExplain ? "Ver de qué gastos sale" : "Gastos compartidos"}
            </Text>
            {canExplain && <Ionicons name="chevron-forward" size={11} color={t.labelSecondary} />}
          </View>
        </Pressable>
        <Pressable onPress={liquidar} className="rounded-pill px-4 py-2" style={{ backgroundColor: t.accent }}>
          <Text className="text-white text-subhead font-semibold">Liquidar</Text>
        </Pressable>
      </View>

      <Modal visible={openDetail} transparent animationType="slide" onRequestClose={() => setOpenDetail(false)}>
        <Pressable className="flex-1" style={{ backgroundColor: t.overlay }} onPress={() => setOpenDetail(false)} />
        <View
          className="rounded-t-[14px] absolute left-0 right-0 bottom-0"
          style={{ maxHeight: "85%", paddingBottom: 24, backgroundColor: t.bg }}
        >
          <SheetHeader title={`Cuentas con ${name}`} onClose={() => setOpenDetail(false)} closeLabel="Listo" />
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <Text className="text-caption1 text-secondary mb-3">
              Cada línea es lo que {name} puso y lo que le tocaba. La suma de la derecha es la deuda.
            </Text>

            {detail && detail.lines.length === 0 ? (
              <Text className="text-tertiary">
                No hay ningún gasto detrás de esta cifra. Si aparece una deuda igualmente, avísame:
                es un fallo.
              </Text>
            ) : (
              <View className="bg-card rounded-lg2 overflow-hidden">
                {detail?.lines.map((l, i) => (
                  <View
                    key={l.id}
                    className="px-4 py-2.5"
                    style={{ borderTopWidth: i ? 0.5 : 0, borderTopColor: t.separator }}
                  >
                    <View className="flex-row items-center" style={{ gap: 8 }}>
                      <Text className="flex-1 text-subhead text-label" numberOfLines={1}>
                        {l.concept}
                      </Text>
                      <Text
                        className="text-subhead font-semibold"
                        style={{ color: l.delta >= 0 ? t.green : t.red, fontVariant: ["tabular-nums"] }}
                      >
                        {l.delta >= 0 ? "+" : "−"}{eur(Math.abs(l.delta))}
                      </Text>
                    </View>
                    <Text className="text-caption1 text-secondary mt-0.5">
                      {[
                        shortDate(l.date),
                        l.paid > 0 ? `puso ${eur(l.paid)}` : null,
                        l.owed > 0 ? `le tocaba ${eur(l.owed)}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  </View>
                ))}
                <View
                  className="flex-row items-center px-4 py-3"
                  style={{ borderTopWidth: 0.5, borderTopColor: t.separator, backgroundColor: t.fill }}
                >
                  <Text className="flex-1 text-subhead font-semibold text-label">Total</Text>
                  <Money size={15} weight="700" color={(detail?.net ?? 0) >= 0 ? t.green : t.red}>
                    {(detail?.net ?? 0) >= 0 ? "+" : "−"}{eur(Math.abs(detail?.net ?? 0))}
                  </Money>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}
