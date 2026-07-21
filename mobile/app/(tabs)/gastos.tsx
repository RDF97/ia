import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useQueryClient } from "@tanstack/react-query";
import { Screen } from "@/components/Screen";
import { Card, PhaseCard, cardShadow } from "@/components/Card";
import { Avatar, Fab, IconTile, Money, SectionTitle } from "@/components/ui";
import { Segmented } from "@/components/Segmented";
import { BudgetModal } from "@/components/gastos/BudgetModal";
import { CsvModal } from "@/components/gastos/CsvModal";
import { ScanModal } from "@/components/gastos/ScanModal";
import { useHogar } from "@/lib/hogar";
import { useAuth } from "@/lib/auth";
import { appwriteConfigured } from "@/lib/appwrite";
import { useExpenses } from "@/lib/useExpenses";
import { useCategories } from "@/lib/useCategories";
import { accountTotals, addExpense, balances, deleteExpense, effectiveAccount, monthlyTotal, type Account } from "@/lib/expenses";
import {
  budgetStatus,
  budgetTotals,
  getBudgetEnabled,
  setBudgetEnabled,
  type Category,
  type CategorySpend,
} from "@/lib/categories";
import { useTheme } from "@/theme/theme";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];
const eur = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

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
  const { data: categories } = useCategories(hogarId);
  const [open, setOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [budgetOn, setBudgetOn] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | Account>("all");

  useEffect(() => {
    getBudgetEnabled(hogarId).then(setBudgetOn).catch(() => undefined);
  }, [hogarId]);

  const toggleBudget = (on: boolean) => {
    setBudgetOn(on);
    setBudgetEnabled(hogarId, on).catch(() => setBudgetOn(!on));
  };

  const refresh = () => qc.invalidateQueries({ queryKey: ["expenses", hogarId] });
  const list = expenses ?? [];
  const cats = categories ?? [];
  const total = monthlyTotal(list);
  const bal = balances(list, members);
  const accTotals = accountTotals(list);
  const movements = filter === "all" ? list : list.filter((e) => effectiveAccount(e) === filter);

  const rows = budgetStatus(cats, list);
  const budgeted = rows.filter((r) => r.hasBudget);
  const totals = budgetTotals(rows);
  const monthLabel = MONTHS[new Date().getMonth()];

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
    <Screen
      title="Gastos"
      subtitle="Este mes"
      onRefresh={refresh}
      contentBottom={150}
      right={
        <Pressable
          onPress={() => setBudgetOpen(true)}
          className="rounded-pill items-center justify-center"
          style={{ width: 36, height: 36, backgroundColor: t.fill, marginBottom: 4 }}
        >
          <Ionicons name="pie-chart-outline" size={17} color={t.accent} />
        </Pressable>
      }
      floating={<Fab onPress={() => setOpen(true)} />}
    >
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
        {total > 0 && (
          <View className="flex-row mt-3 pt-3" style={{ gap: 16, borderTopWidth: 0.5, borderTopColor: t.separator }}>
            <View className="flex-row items-center" style={{ gap: 7 }}>
              <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: t.accent }} />
              <Text className="text-[13px] text-secondary">Conjunta</Text>
              <Text className="text-[13px] font-semibold text-label" style={{ fontVariant: ["tabular-nums"] }}>{eur(accTotals.joint)}</Text>
            </View>
            <View className="flex-row items-center" style={{ gap: 7 }}>
              <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: t.purple }} />
              <Text className="text-[13px] text-secondary">Individual</Text>
              <Text className="text-[13px] font-semibold text-label" style={{ fontVariant: ["tabular-nums"] }}>{eur(accTotals.individual)}</Text>
            </View>
          </View>
        )}
      </Card>

      {budgetOn && (
        <BudgetSection
          rows={budgeted}
          totals={totals}
          monthLabel={monthLabel}
          hasCategories={cats.length > 0}
          onManage={() => setBudgetOpen(true)}
        />
      )}

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
      {list.length > 0 && (
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { key: "all", label: "Todo" },
            { key: "joint", label: "Conjunta" },
            { key: "individual", label: "Individual" },
          ]}
        />
      )}
      {isLoading ? (
        <ActivityIndicator color={t.accent} style={{ marginTop: 16 }} />
      ) : movements.length === 0 ? (
        <Text className="text-center text-tertiary mt-6">
          {list.length === 0 ? "Sin gastos todavía." : "Sin movimientos en esta cuenta."}
        </Text>
      ) : (
        <View className="bg-card rounded-lg2 mx-4 mb-3 overflow-hidden" style={cardShadow(t.dark)}>
          {movements.map((e, i) => {
            const joint = effectiveAccount(e) === "joint";
            const icon = joint ? "wallet" : e.shared ? "people" : "person";
            const color = joint ? t.accent : e.shared ? t.teal : t.gray;
            const source = joint ? "conjunta" : e.shared ? "compartido" : "personal";
            return (
              <Pressable
                key={e.$id}
                onLongPress={() => remove(e.$id)}
                className="flex-row items-center px-4 py-3"
                style={{ gap: 12, borderTopWidth: i ? 0.5 : 0, borderTopColor: t.separator }}
              >
                <IconTile icon={icon} color={color} />
                <View className="flex-1">
                  <Text className="text-[16px] text-label">{e.concept}</Text>
                  <Text className="text-[13px] text-secondary mt-0.5">
                    {e.paidByName} · {source}
                    {e.category ? ` · ${e.category}` : ""}
                  </Text>
                </View>
                <Money size={15} weight="500" color={t.red}>
                  −{eur(e.amount)}
                </Money>
              </Pressable>
            );
          })}
        </View>
      )}
      <Text className="text-center text-[12px] text-tertiary mb-2">Mantén pulsado un gasto para borrarlo</Text>

      <View className="flex-row justify-center mx-4 mt-1" style={{ gap: 20 }}>
        <Pressable onPress={() => setScanOpen(true)} className="flex-row items-center" style={{ gap: 6 }}>
          <Ionicons name="scan-outline" size={16} color={t.accent} />
          <Text className="text-[14px] font-semibold text-accent">Escanear ticket</Text>
        </Pressable>
        <Pressable onPress={() => setCsvOpen(true)} className="flex-row items-center" style={{ gap: 6 }}>
          <Ionicons name="document-text-outline" size={16} color={t.accent} />
          <Text className="text-[14px] font-semibold text-accent">CSV del banco</Text>
        </Pressable>
      </View>

      <AddExpense visible={open} onClose={() => setOpen(false)} hogarId={hogarId} userName={userName} categories={cats} onAdded={refresh} />
      <BudgetModal visible={budgetOpen} hogarId={hogarId} enabled={budgetOn} onToggle={toggleBudget} onClose={() => setBudgetOpen(false)} />
      <CsvModal visible={csvOpen} hogarId={hogarId} userName={userName} expenses={list} onClose={() => setCsvOpen(false)} onImported={refresh} />
      <ScanModal visible={scanOpen} hogarId={hogarId} userName={userName} categories={cats} onClose={() => setScanOpen(false)} onDone={refresh} />
    </Screen>
  );
}

function BudgetSection({
  rows,
  totals,
  monthLabel,
  hasCategories,
  onManage,
}: {
  rows: CategorySpend[];
  totals: { budget: number; spent: number };
  monthLabel: string;
  hasCategories: boolean;
  onManage: () => void;
}) {
  const t = useTheme();
  const stateColor = (s: CategorySpend["state"]) => (s === "over" ? t.red : s === "warn" ? t.orange : t.accent);

  if (rows.length === 0) {
    return (
      <>
        <SectionTitle>Presupuesto · {monthLabel}</SectionTitle>
        <Pressable onPress={onManage} className="bg-card rounded-lg2 mx-4 mb-3 px-4 py-3 flex-row items-center" style={{ gap: 12, ...cardShadow(t.dark) }}>
          <View className="rounded-lg items-center justify-center" style={{ width: 30, height: 30, backgroundColor: t.accent }}>
            <Ionicons name="pie-chart" size={16} color="#fff" />
          </View>
          <Text className="flex-1 text-[14px] text-secondary">
            {hasCategories ? "Ponle un límite mensual a tus categorías" : "Crea categorías para empezar a presupuestar"}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={t.tabInactive} />
        </Pressable>
      </>
    );
  }

  const totalPct = totals.budget > 0 ? totals.spent / totals.budget : 0;
  const totalCol = totals.spent > totals.budget ? t.red : totalPct >= 0.85 ? t.orange : t.accent;
  const remaining = totals.budget - totals.spent;

  return (
    <>
      {/* Tarjeta grande "presupuesto mensual" (como el mockup) */}
      <View className="bg-card rounded-card mx-4 mb-3 p-4" style={cardShadow(t.dark)}>
        <View className="flex-row items-end justify-between mb-3.5">
          <View>
            <Text className="text-[12px] text-secondary mb-1" style={{ textTransform: "uppercase", letterSpacing: 0.4 }}>Presupuesto · {monthLabel}</Text>
            <Text className="text-[34px] font-bold text-label" style={{ lineHeight: 36, letterSpacing: -1, fontVariant: ["tabular-nums"] }}>{eur(totals.spent)}</Text>
          </View>
          <Text className="text-[14px] text-secondary mb-1">de {eur(totals.budget)}</Text>
        </View>
        <ProgressBar pct={totalPct} color={totalCol} />
        <View className="flex-row justify-between mt-2">
          <Text className="text-[12px] text-secondary">{Math.round(totalPct * 100)}% usado</Text>
          <Text className="text-[12px]" style={{ color: remaining < 0 ? t.red : t.labelSecondary }}>
            {remaining >= 0 ? `${eur(remaining)} restantes` : `${eur(-remaining)} de más`}
          </Text>
        </View>
      </View>

      <SectionTitle action="Editar presupuesto" onAction={onManage}>Por categoría</SectionTitle>
      <View className="flex-row flex-wrap mx-4 mb-2" style={{ gap: 8 }}>
        {rows.map((r) => {
          const col = stateColor(r.state);
          return (
            <View key={r.$id} className="bg-card rounded-lg2 p-3" style={{ flexGrow: 1, flexBasis: "46%", ...cardShadow(t.dark) }}>
              <View className="flex-row items-center mb-2" style={{ gap: 8 }}>
                <View className="rounded-md items-center justify-center" style={{ width: 24, height: 24, backgroundColor: r.color }}>
                  <Ionicons name={r.icon as IoniconName} size={13} color="#fff" />
                </View>
                <Text className="text-[13px] font-medium text-label" numberOfLines={1} style={{ flex: 1 }}>{r.name}</Text>
              </View>
              <Text className="text-[15px] font-semibold text-label mb-1.5" style={{ fontVariant: ["tabular-nums"], letterSpacing: -0.2 }}>
                {eur(r.spent)} <Text className="text-[12px] text-secondary font-normal">/ {eur(r.budget)}</Text>
              </Text>
              <ProgressBar pct={r.pct} color={col} />
            </View>
          );
        })}
      </View>
    </>
  );
}

/** Barra de progreso 6px con relleno de color (como .progress del mockup). */
function ProgressBar({ pct, color }: { pct: number; color: string }) {
  const t = useTheme();
  const w = `${Math.max(0, Math.min(100, Math.round(pct * 100)))}%` as `${number}%`;
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: t.fill, overflow: "hidden" }}>
      <View style={{ width: w, height: "100%", borderRadius: 3, backgroundColor: color }} />
    </View>
  );
}

function AddExpense({
  visible,
  onClose,
  hogarId,
  userName,
  categories,
  onAdded,
}: {
  visible: boolean;
  onClose: () => void;
  hogarId: string;
  userName: string;
  categories: Category[];
  onAdded: () => void;
}) {
  const t = useTheme();
  const [amount, setAmount] = useState("");
  const [concept, setConcept] = useState("");
  const [shared, setShared] = useState(true);
  const [account, setAccount] = useState<Account>("joint");
  const [category, setCategory] = useState<string | null>(null);
  const [date, setDate] = useState(new Date());
  const [showDate, setShowDate] = useState(false);
  const [busy, setBusy] = useState(false);

  const onPickDate = (_e: DateTimePickerEvent, d?: Date) => {
    setShowDate(false);
    if (d) setDate(d);
  };

  const submit = async () => {
    const value = parseFloat(amount.replace(",", "."));
    if (!isFinite(value) || value <= 0 || !concept.trim()) return;
    setBusy(true);
    try {
      await addExpense(hogarId, {
        amount: value,
        concept: concept.trim(),
        paidByName: userName,
        account,
        shared: account === "joint" ? true : shared,
        category: category ?? undefined,
        spentAt: date.toISOString(),
      });
      onAdded();
      setAmount("");
      setConcept("");
      setShared(true);
      setAccount("joint");
      setCategory(null);
      setDate(new Date());
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

        <Pressable onPress={() => setShowDate(true)} className="bg-card rounded-lg2 px-4 py-3 mb-3 flex-row items-center" style={{ gap: 10 }}>
          <Ionicons name="calendar-outline" size={18} color={t.accent} />
          <Text className="flex-1 text-[16px] text-label">Fecha</Text>
          <Text className="text-[15px] text-secondary">
            {`${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`}
          </Text>
        </Pressable>
        {showDate && (
          <DateTimePicker value={date} mode="date" onChange={onPickDate} display={Platform.OS === "ios" ? "spinner" : "default"} />
        )}

        {categories.length > 0 && (
          <>
            <Text className="text-[12px] font-medium uppercase tracking-wide text-secondary mb-2">Categoría</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4" contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
              {categories.map((c) => {
                const on = category === c.name;
                return (
                  <Pressable
                    key={c.$id}
                    onPress={() => setCategory(on ? null : c.name)}
                    className="flex-row items-center rounded-pill px-3 py-2"
                    style={{ gap: 6, backgroundColor: on ? c.color : t.fill }}
                  >
                    <Ionicons name={c.icon as IoniconName} size={14} color={on ? "#fff" : c.color} />
                    <Text className="text-[13px] font-medium" style={{ color: on ? "#fff" : t.label }}>{c.name}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        )}

        <Text className="text-[12px] font-medium uppercase tracking-wide text-secondary mb-2">Cuenta</Text>
        <View className="flex-row mb-4" style={{ gap: 8 }}>
          {([
            { key: "joint", label: "Conjunta", icon: "wallet" },
            { key: "individual", label: "Individual", icon: "person" },
          ] as const).map((o) => {
            const on = account === o.key;
            return (
              <Pressable
                key={o.key}
                onPress={() => setAccount(o.key)}
                className="flex-1 flex-row items-center justify-center rounded-lg2 py-3"
                style={{ gap: 7, backgroundColor: on ? t.accent : t.card, borderWidth: 1, borderColor: on ? t.accent : t.separator }}
              >
                <Ionicons name={o.icon} size={16} color={on ? "#fff" : t.labelSecondary} />
                <Text className="text-[15px] font-medium" style={{ color: on ? "#fff" : t.label }}>{o.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {account === "individual" && (
          <View className="flex-row items-center justify-between bg-card rounded-lg2 px-4 py-3 mb-4">
            <View className="flex-1 pr-3">
              <Text className="text-[15px] text-label">Compartido con el hogar</Text>
              <Text className="text-[12px] text-secondary mt-0.5">Los demás te devuelven su parte</Text>
            </View>
            <Switch value={shared} onValueChange={setShared} trackColor={{ true: t.accent, false: t.separator }} />
          </View>
        )}
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
