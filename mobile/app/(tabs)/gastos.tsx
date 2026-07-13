import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { Screen } from "@/components/Screen";
import { Card, PhaseCard } from "@/components/Card";
import { useHogar } from "@/lib/hogar";
import { useAuth } from "@/lib/auth";
import { appwriteConfigured } from "@/lib/appwrite";
import { useExpenses } from "@/lib/useExpenses";
import {
  addExpense,
  balances,
  deleteExpense,
  monthlyTotal,
  type Expense,
} from "@/lib/expenses";
import { colors } from "@/theme/tokens";

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

function GastosView({
  hogarId,
  members,
  userName,
}: {
  hogarId: string;
  members: number;
  userName: string;
}) {
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
        <Text className="text-center text-[13px] mb-2" style={{ color: colors.red }}>
          No se pudieron cargar los gastos. Desliza hacia abajo para reintentar.
        </Text>
      )}
      <View className="rounded-card mx-4 mb-3 p-4" style={{ backgroundColor: colors.accent }}>
        <Text className="text-[11px] font-medium uppercase tracking-wide text-white/90">
          Total del mes
        </Text>
        <Text className="text-[34px] font-bold text-white" style={{ lineHeight: 42 }}>
          {eur(total)}
        </Text>
      </View>

      {bal.length > 0 && (
        <>
          <Text className="px-5 pt-2 pb-2 text-[13px] font-medium uppercase tracking-wide text-neutral-500">
            Reparto (gastos compartidos)
          </Text>
          <Card>
            {bal.map((b, i) => (
              <View
                key={b.name}
                className="flex-row items-center justify-between py-2"
                style={{ borderTopWidth: i ? 0.5 : 0, borderTopColor: colors.separator }}
              >
                <Text className="text-[15px] text-black">{b.name}</Text>
                <Text
                  className="text-[15px] font-semibold"
                  style={{ color: b.net >= 0 ? colors.green : colors.red }}
                >
                  {b.net >= 0 ? `le deben ${eur(b.net)}` : `debe ${eur(-b.net)}`}
                </Text>
              </View>
            ))}
          </Card>
        </>
      )}

      <Text className="px-5 pt-2 pb-2 text-[13px] font-medium uppercase tracking-wide text-neutral-500">
        Movimientos
      </Text>
      {isLoading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 16 }} />
      ) : list.length === 0 ? (
        <Text className="text-center text-neutral-400 mt-6">Sin gastos todavía.</Text>
      ) : (
        <View className="bg-white rounded-lg2 mx-4 mb-3 overflow-hidden">
          {list.map((e, i) => (
            <Pressable
              key={e.$id}
              onLongPress={() => remove(e.$id)}
              className="flex-row items-center px-4 py-3"
              style={{ gap: 12, borderTopWidth: i ? 0.5 : 0, borderTopColor: colors.separator }}
            >
              <View className="flex-1">
                <Text className="text-[16px] text-black">{e.concept}</Text>
                <Text className="text-[12px] text-neutral-500 mt-0.5">
                  {e.paidByName}
                  {e.shared ? " · compartido" : ""}
                  {e.category ? ` · ${e.category}` : ""}
                </Text>
              </View>
              <Text className="text-[15px] font-semibold" style={{ color: colors.red }}>
                −{eur(e.amount)}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      <Text className="text-center text-[12px] text-neutral-400 mb-2">
        Mantén pulsado un gasto para borrarlo
      </Text>

      <Pressable
        onPress={() => setOpen(true)}
        className="rounded-[14px] mx-4 py-3.5 items-center flex-row justify-center"
        style={{ backgroundColor: colors.accent, gap: 8 }}
      >
        <Ionicons name="add" size={20} color="#fff" />
        <Text className="text-white text-base font-semibold">Añadir gasto</Text>
      </Pressable>

      <AddExpense
        visible={open}
        onClose={() => setOpen(false)}
        hogarId={hogarId}
        userName={userName}
        onAdded={refresh}
      />
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
      <Pressable className="flex-1 bg-black/40" onPress={onClose} />
      <View className="bg-bg-app rounded-t-[14px] absolute left-0 right-0 bottom-0 p-5" style={{ paddingBottom: 32 }}>
        <Text className="text-[17px] font-semibold mb-4">Nuevo gasto</Text>
        <TextInput
          className="bg-white rounded-lg2 px-4 py-3 mb-3 text-[16px] text-black"
          placeholder="Importe (€)"
          placeholderTextColor={colors.labelSecondary}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
        />
        <TextInput
          className="bg-white rounded-lg2 px-4 py-3 mb-3 text-[16px] text-black"
          placeholder="Concepto"
          placeholderTextColor={colors.labelSecondary}
          value={concept}
          onChangeText={setConcept}
        />
        <View className="flex-row items-center justify-between bg-white rounded-lg2 px-4 py-3 mb-4">
          <Text className="text-[15px] text-black">Compartido</Text>
          <Switch
            value={shared}
            onValueChange={setShared}
            trackColor={{ true: colors.accent, false: "#ccc" }}
          />
        </View>
        <Pressable
          onPress={submit}
          disabled={busy}
          className="rounded-[14px] py-3.5 items-center"
          style={{ backgroundColor: colors.accent, opacity: busy ? 0.6 : 1 }}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white text-base font-semibold">Guardar</Text>
          )}
        </Pressable>
      </View>
    </Modal>
  );
}
