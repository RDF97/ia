import { useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, Switch, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { Screen } from "@/components/Screen";
import { Card, PhaseCard, cardShadow } from "@/components/Card";
import { Avatar, IconTile, Money, SectionTitle } from "@/components/ui";
import { useHogar } from "@/lib/hogar";
import { useAuth } from "@/lib/auth";
import { appwriteConfigured } from "@/lib/appwrite";
import { useExpenses } from "@/lib/useExpenses";
import { addExpense, balances, deleteExpense, monthlyTotal } from "@/lib/expenses";
import { useTheme } from "@/theme/theme";

const eur = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;

export default function Gastos() {
  const { active } = useHogar();
  const { user } = useAuth();

  if (!appwriteConfigured || !active) {
    return (
      <Screen title="Gastos" subtitle="Presupuesto y reparto">
        <PhaseCard phase="Fase 4 · Gastos">
          Gastos del hogar en tiempo real, total del mes y “quién debe a quién”. Se activa al
          configurar el backend y entrar en un hogar.
        </PhaseCard>
      </Screen>
    );
  }
  return <GastosView hogarId={active.$id} members={active.total} userName={user?.name || "Yo"} />;
}

function GastosView({ hogarId, members, userName }: { hogarId: string; members: number; userName: string }) {
  const t = useTheme();
  const qc = useQueryClient();
  const { data: expenses, isLoading, isError } = useExpenses(hogarId);
  const [open, setOpen] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ["expenses", hogarId] });
  const list = expenses ?? [];
  const total = monthlyTotal(list);
  const bal = balances(list, members);

  const remove = (id: string) =>
    Alert.alert("Borrar gasto", "¿Seguro?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Borrar",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteExpense(id);
            refresh();
          } catch (e) {
            Alert.alert("No se pudo borrar", e instanceof Error ? e.message : "Inténtalo de nuevo.");
          }
        },
      },
    ]);

  return (
    <Screen title="Gastos" subtitle="Este mes" onRefresh={refresh}>
      {isError && (
        <Text className="text-center text-[13px] mb-2" style={{ color: t.red }}>
          No se pudieron cargar los gastos. Desliza hacia abajo para reintentar.
        </Text>
      )}
      <Card>
        <Text className="text-[12px] text-secondary mb-1" style={{ textTransform: "uppercase", letterSpacing: 0.4 }}>
          Gastado este mes
        </Text>
        <Text className="text-[36px] font-bold text-label" style={{ lineHeight: 42, letterSpacing: -1, fontVariant: ["tabular-nums"] }}>
          {eur(total)}
        </Text>
      </Card>

      {bal.length > 0 && (
        <>
          <SectionTitle>Reparto · gastos compartidos</SectionTitle>
          <View className="rounded-card mx-4 mb-3 px-4 py-3" style={{ backgroundColor: t.accentSoft }}>
            {bal.map((b, i) => (
              <View key={b.name} className="flex-row items-center py-2" style={{ gap: 12, borderTopWidth: i ? 0.5 : 0, borderTopColor: t.separator }}>
                <Avatar name={b.name} size={32} />
                <View className="flex-1">
                  <Text className="text-[12px] text-secondary">{b.name}</Text>
                  <Money size={18} weight="700" color={b.net >= 0 ? t.accent : t.red}>
                    {b.net >= 0 ? `le deben ${eur(b.net)}` : `debe ${eur(-b.net)}`}
                  </Money>
                </View>
              </View>
            ))}
          </View>
        </>
      )}

      <SectionTitle>Movimientos recientes</SectionTitle>
      {isLoading ? (
        <ActivityIndicator color={t.accent} style={{ marginTop: 16 }} />
      ) : list.length === 0 ? (
        <Text className="text-center text-tertiary mt-6">Sin gastos todavía.</Text>
      ) : (
        <View className="bg-card rounded-lg2 mx-4 mb-3 overflow-hidden" style={cardShadow(t.dark)}>
          {list.map((e, i) => (
            <Pressable
              key={e.$id}
              onLongPress={() => remove(e.$id)}
              className="flex-row items-center px-4 py-3"
              style={{ gap: 12, borderTopWidth: i ? 0.5 : 0, borderTopColor: t.separator }}
            >
              <IconTile icon={e.shared ? "people" : "cart"} color={e.shared ? t.teal : t.orange} />
              <View className="flex-1">
                <Text className="text-[16px] text-label">{e.concept}</Text>
                <Text className="text-[13px] text-secondary mt-0.5">
                  {e.paidByName}
                  {e.shared ? " · compartido" : ""}
                  {e.category ? ` · ${e.category}` : ""}
                </Text>
              </View>
              <Money size={15} weight="500" color={t.red}>
                −{eur(e.amount)}
              </Money>
            </Pressable>
          ))}
        </View>
      )}
      <Text className="text-center text-[12px] text-tertiary mb-2">Mantén pulsado un gasto para borrarlo</Text>

      <Pressable
        onPress={() => setOpen(true)}
        className="rounded-[14px] mx-4 py-3.5 items-center flex-row justify-center"
        style={{ backgroundColor: t.accent, gap: 8 }}
      >
        <Ionicons name="add" size={20} color="#fff" />
        <Text className="text-white text-base font-semibold">Añadir gasto</Text>
      </Pressable>

      <AddExpense visible={open} onClose={() => setOpen(false)} hogarId={hogarId} userName={userName} onAdded={refresh} />
    </Screen>
  );
}

function AddExpense({
  visible,
  onClose,
  hogarId,
  userName,
  onAdded,
}: {
  visible: boolean;
  onClose: () => void;
  hogarId: string;
  userName: string;
  onAdded: () => void;
}) {
  const t = useTheme();
  const [amount, setAmount] = useState("");
  const [concept, setConcept] = useState("");
  const [shared, setShared] = useState(true);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const value = parseFloat(amount.replace(",", "."));
    if (!isFinite(value) || value <= 0 || !concept.trim()) return;
    setBusy(true);
    try {
      await addExpense(hogarId, { amount: value, concept: concept.trim(), paidByName: userName, shared });
      onAdded();
      setAmount("");
      setConcept("");
      setShared(true);
      onClose();
    } catch (e) {
      Alert.alert("No se pudo guardar", e instanceof Error ? e.message : "Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1" style={{ backgroundColor: t.overlay }} onPress={onClose} />
      <View className="rounded-t-[14px] absolute left-0 right-0 bottom-0 p-5" style={{ paddingBottom: 32, backgroundColor: t.bg }}>
        <Text className="text-[17px] font-semibold mb-4 text-label">Nuevo gasto</Text>
        <TextInput
          className="bg-card rounded-lg2 px-4 py-3 mb-3 text-[16px] text-label"
          placeholder="Importe (€)"
          placeholderTextColor={t.labelTertiary}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
        />
        <TextInput
          className="bg-card rounded-lg2 px-4 py-3 mb-3 text-[16px] text-label"
          placeholder="Concepto"
          placeholderTextColor={t.labelTertiary}
          value={concept}
          onChangeText={setConcept}
        />
        <View className="flex-row items-center justify-between bg-card rounded-lg2 px-4 py-3 mb-4">
          <Text className="text-[15px] text-label">Compartido</Text>
          <Switch value={shared} onValueChange={setShared} trackColor={{ true: t.accent, false: t.separator }} />
        </View>
        <Pressable
          onPress={submit}
          disabled={busy}
          className="rounded-[14px] py-3.5 items-center"
          style={{ backgroundColor: t.accent, opacity: busy ? 0.6 : 1 }}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text className="text-white text-base font-semibold">Guardar</Text>}
        </Pressable>
      </View>
    </Modal>
  );
}
