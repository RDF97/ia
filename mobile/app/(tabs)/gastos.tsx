import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useQueryClient } from "@tanstack/react-query";
import { Screen } from "@/components/Screen";
import { Card, PhaseCard, cardShadow } from "@/components/Card";
import { AddFab, IconTile, Money, SectionTitle } from "@/components/ui";
import { SwipeToDelete } from "@/components/SwipeToDelete";
import { UploadCard } from "@/components/UploadCard";
import { Segmented } from "@/components/Segmented";
import { DebtCard } from "@/components/DebtCard";
import { BudgetModal } from "@/components/gastos/BudgetModal";
import { CsvModal } from "@/components/gastos/CsvModal";
import { ScanModal } from "@/components/gastos/ScanModal";
import { useHogar } from "@/lib/hogar";
import { useAuth } from "@/lib/auth";
import { appwriteConfigured } from "@/lib/appwrite";
import { useExpenses } from "@/lib/useExpenses";
import { useCategories } from "@/lib/useCategories";
import { useSettlements } from "@/lib/useSettlements";
import { useMembers } from "@/lib/useMembers";
import { accountTotals, addExpense, balances, deleteExpense, effectiveAccount, expenseDate, parseExpenseItems, updateExpense, type Account, type Expense } from "@/lib/expenses";
import {
  budgetStatus,
  budgetTotals,
  getBudgetEnabled,
  setBudgetEnabled,
  type Category,
  type CategorySpend,
} from "@/lib/categories";
import { useTheme } from "@/theme/theme";
import { useKeyboardHeight } from "@/lib/useKeyboard";

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
  const kb = useKeyboardHeight();
  const qc = useQueryClient();
  const { data: expenses, isLoading, isError } = useExpenses(hogarId);
  const { data: categories } = useCategories(hogarId);
  const { data: settlements } = useSettlements(hogarId);
  const memberNames = (useMembers(hogarId).data ?? []).map((m) => m.name);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [budgetOn, setBudgetOn] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [scanSource, setScanSource] = useState<"camera" | "library" | "pdf" | null>(null);
  const [filter, setFilter] = useState<"all" | Account>("all");
  const [catFilter, setCatFilter] = useState<string | null>(null);
  // Mes que se está viendo (se puede retroceder/avanzar).
  const [month, setMonth] = useState(() => {
    const n = new Date();
    return { y: n.getFullYear(), m: n.getMonth() };
  });

  useEffect(() => {
    getBudgetEnabled(hogarId).then(setBudgetOn).catch(() => undefined);
  }, [hogarId]);

  const toggleBudget = (on: boolean) => {
    setBudgetOn(on);
    setBudgetEnabled(hogarId, on).catch(() => setBudgetOn(!on));
  };

  const refresh = () => qc.invalidateQueries({ queryKey: ["expenses", hogarId] });
  const refreshBal = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["expenses", hogarId] }),
      qc.invalidateQueries({ queryKey: ["settlements", hogarId] }),
    ]);
  const all = expenses ?? [];
  const cats = categories ?? [];
  const monthDate = new Date(month.y, month.m, 15);
  // Solo los gastos del mes que se está viendo.
  const list = all.filter((e) => {
    const d = new Date(expenseDate(e));
    return d.getFullYear() === month.y && d.getMonth() === month.m;
  });
  const total = list.reduce((s, e) => s + e.amount, 0);
  const bal = balances(all, members, settlements ?? [], memberNames);
  const accTotals = accountTotals(list, monthDate);
  // "Gasto individual" = mi parte de la conjunta + lo que he puesto de mi bolsillo.
  const myOwn = list
    .filter((e) => effectiveAccount(e) === "individual" && e.paidByName === userName)
    .reduce((s, e) => s + e.amount, 0);
  const myTotals = {
    joint: accTotals.joint,
    individual: myOwn + (members > 0 ? accTotals.joint / members : 0),
  };
  const byAccount = filter === "all" ? list : list.filter((e) => effectiveAccount(e) === filter);
  const movements = catFilter ? byAccount.filter((e) => e.category === catFilter) : byAccount;

  const rows = budgetStatus(cats, list, monthDate);
  const budgeted = rows.filter((r) => r.hasBudget);
  const totals = budgetTotals(rows);
  const monthLabel = MONTHS[month.m];
  const isCurrentMonth = month.y === new Date().getFullYear() && month.m === new Date().getMonth();
  const shiftMonth = (delta: number) =>
    setMonth((prev) => {
      const d = new Date(prev.y, prev.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

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
      floating={<AddFab onPress={() => setOpen(true)} />}
    >
      {/* Selector de mes, como el mockup */}
      <View className="flex-row items-center mx-4 mb-3" style={{ gap: 8 }}>
        <Pressable
          onPress={() => shiftMonth(-1)}
          hitSlop={8}
          className="rounded-pill items-center justify-center"
          style={{ width: 32, height: 32, backgroundColor: t.fill }}
        >
          <Ionicons name="chevron-back" size={16} color={t.accent} />
        </Pressable>
        <View className="rounded-pill px-4 py-1.5" style={{ backgroundColor: t.fill }}>
          <Text className="text-[14px] font-medium text-label">
            {monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)} {month.y}
          </Text>
        </View>
        <Pressable
          onPress={() => shiftMonth(1)}
          hitSlop={8}
          disabled={isCurrentMonth}
          className="rounded-pill items-center justify-center"
          style={{ width: 32, height: 32, backgroundColor: t.fill, opacity: isCurrentMonth ? 0.4 : 1 }}
        >
          <Ionicons name="chevron-forward" size={16} color={t.accent} />
        </Pressable>
        {!isCurrentMonth && (
          <Pressable onPress={() => setMonth({ y: new Date().getFullYear(), m: new Date().getMonth() })} hitSlop={8}>
            <Text className="text-[13px] font-medium" style={{ color: t.accent }}>Hoy</Text>
          </Pressable>
        )}
      </View>

      <UploadCard
        title="Subir gasto"
        subtitle="OCR o CSV · lo categoriza y lo añade"
        actions={[
          { key: "camera", label: "Cámara", icon: "camera-outline", onPress: () => setScanSource("camera") },
          { key: "library", label: "Galería", icon: "images-outline", onPress: () => setScanSource("library") },
          { key: "pdf", label: "PDF", icon: "document-text-outline", onPress: () => setScanSource("pdf") },
          { key: "csv", label: "CSV", icon: "swap-horizontal-outline", onPress: () => setCsvOpen(true) },
        ]}
      />

      {isError && (
        <Text className="text-center text-[13px] mb-2" style={{ color: t.red }}>
          No se pudieron cargar los gastos. Desliza hacia abajo para reintentar.
        </Text>
      )}
      <Card>
        <Text className="text-[12px] text-secondary mb-1" style={{ textTransform: "uppercase", letterSpacing: 0.4 }}>
          Gastado · {monthLabel}
        </Text>
        <Text className="text-[36px] font-bold text-label" style={{ lineHeight: 42, letterSpacing: -1, fontVariant: ["tabular-nums"] }}>
          {eur(total)}
        </Text>
        {total > 0 && (
          <View className="flex-row mt-3 pt-3" style={{ gap: 16, borderTopWidth: 0.5, borderTopColor: t.separator }}>
            <View className="flex-1">
              <View className="flex-row items-center mb-0.5" style={{ gap: 7 }}>
                <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: t.purple }} />
                <Text className="text-[13px] text-secondary">Gasto individual</Text>
              </View>
              <Text className="text-[17px] font-semibold text-label" style={{ fontVariant: ["tabular-nums"] }}>
                {eur(myTotals.individual)}
              </Text>
              <Text className="text-[11px] text-tertiary">mi parte de la conjunta + lo mío</Text>
            </View>
            <View className="flex-1">
              <View className="flex-row items-center mb-0.5" style={{ gap: 7 }}>
                <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: t.accent }} />
                <Text className="text-[13px] text-secondary">Gasto conjunto</Text>
              </View>
              <Text className="text-[17px] font-semibold text-label" style={{ fontVariant: ["tabular-nums"] }}>
                {eur(myTotals.joint)}
              </Text>
              <Text className="text-[11px] text-tertiary">solo cuenta conjunta</Text>
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
          selected={catFilter}
          onSelect={setCatFilter}
        />
      )}

      {bal.length > 0 && (
        <>
          <SectionTitle>Quién debe a quién</SectionTitle>
          {bal
            .filter((b) => b.name !== userName)
            .map((b) => (
              <DebtCard key={b.name} hogarId={hogarId} userName={userName} name={b.name} net={b.net} onDone={refreshBal} />
            ))}
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
              <SwipeToDelete key={e.$id} onDelete={() => remove(e.$id)}>
              <Pressable
                onPress={() => setEditing(e)}
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
              </SwipeToDelete>
            );
          })}
        </View>
      )}
      <Text className="text-center text-[12px] text-tertiary mb-2">Toca un gasto para editarlo · desliza para borrarlo</Text>

      <AddExpense visible={open} onClose={() => setOpen(false)} hogarId={hogarId} userName={userName} categories={cats} onAdded={refresh} />
      <BudgetModal visible={budgetOpen} hogarId={hogarId} enabled={budgetOn} onToggle={toggleBudget} onClose={() => setBudgetOpen(false)} />
      <CsvModal visible={csvOpen} hogarId={hogarId} userName={userName} expenses={list} onClose={() => setCsvOpen(false)} onImported={refresh} />
      <ScanModal
        visible={scanSource !== null}
        hogarId={hogarId}
        userName={userName}
        categories={cats}
        initialSource={scanSource}
        onClose={() => setScanSource(null)}
        onDone={() => {
          setScanSource(null);
          refresh();
        }}
      />
      <AddExpense
        visible={editing !== null}
        expense={editing}
        onClose={() => setEditing(null)}
        hogarId={hogarId}
        userName={userName}
        categories={cats}
        onAdded={() => {
          setEditing(null);
          refresh();
        }}
        onDelete={(id) => {
          setEditing(null);
          remove(id);
        }}
      />
    </Screen>
  );
}

function BudgetSection({
  rows,
  totals,
  monthLabel,
  hasCategories,
  onManage,
  selected,
  onSelect,
}: {
  rows: CategorySpend[];
  totals: { budget: number; spent: number };
  monthLabel: string;
  hasCategories: boolean;
  onManage: () => void;
  /** Categoría por la que se están filtrando los movimientos. */
  selected: string | null;
  onSelect: (name: string | null) => void;
}) {
  const t = useTheme();
  const kb = useKeyboardHeight();
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

      <View className="flex-row items-center justify-between px-5 pt-4 pb-2">
        <Text
          className="text-[13px] font-medium"
          style={{ color: t.labelSecondary, textTransform: "uppercase", letterSpacing: 0.5 }}
        >
          Por categoría
        </Text>
        <Pressable
          onPress={onManage}
          className="flex-row items-center rounded-pill px-3 py-1.5"
          style={{ gap: 4, backgroundColor: t.accentSoft }}
        >
          <Ionicons name="add" size={13} color={t.accent} />
          <Text className="text-[13px] font-semibold" style={{ color: t.accent }}>Editar presupuesto</Text>
        </Pressable>
      </View>
      <View className="flex-row flex-wrap mx-4 mb-2" style={{ gap: 8 }}>
        {rows.map((r) => {
          const col = stateColor(r.state);
          const on = selected === r.name;
          return (
            <Pressable
              key={r.$id}
              onPress={() => onSelect(on ? null : r.name)}
              className="bg-card rounded-lg2 p-3"
              style={{
                flexGrow: 1,
                flexBasis: "46%",
                borderWidth: on ? 1.5 : 0,
                borderColor: on ? r.color : "transparent",
                ...cardShadow(t.dark),
              }}
            >
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
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

/** Barra de progreso 6px con relleno de color (como .progress del mockup). */
function ProgressBar({ pct, color }: { pct: number; color: string }) {
  const t = useTheme();
  const kb = useKeyboardHeight();
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
  expense = null,
  onDelete,
}: {
  visible: boolean;
  onClose: () => void;
  hogarId: string;
  userName: string;
  categories: Category[];
  onAdded: () => void;
  /** Si viene un gasto, el formulario edita en vez de crear. */
  expense?: Expense | null;
  onDelete?: (id: string) => void;
}) {
  const t = useTheme();
  const kb = useKeyboardHeight();
  const [amount, setAmount] = useState("");
  const [concept, setConcept] = useState("");
  const [shared, setShared] = useState(true);
  const [account, setAccount] = useState<Account>("joint");
  const [category, setCategory] = useState<string | null>(null);
  const [date, setDate] = useState(new Date());
  const [showDate, setShowDate] = useState(false);
  const [busy, setBusy] = useState(false);
  const items = parseExpenseItems(expense?.items);

  const onPickDate = (_e: DateTimePickerEvent, d?: Date) => {
    setShowDate(false);
    if (d) setDate(d);
  };

  // Al abrir, precarga los datos del gasto que se edita (o limpia para uno nuevo).
  useEffect(() => {
    if (!visible) return;
    if (expense) {
      setAmount(String(expense.amount).replace(".", ","));
      setConcept(expense.concept);
      setShared(expense.shared);
      setAccount(effectiveAccount(expense));
      setCategory(expense.category ?? null);
      setDate(new Date(expenseDate(expense)));
    } else {
      setAmount("");
      setConcept("");
      setShared(true);
      setAccount("joint");
      setCategory(null);
      setDate(new Date());
    }
  }, [visible, expense]);

  const submit = async () => {
    const value = parseFloat(amount.replace(",", "."));
    if (!isFinite(value) || value <= 0 || !concept.trim()) return;
    setBusy(true);
    try {
      const data = {
        amount: value,
        concept: concept.trim(),
        account,
        shared: account === "joint" ? true : shared,
        category: category ?? undefined,
        spentAt: date.toISOString(),
      };
      if (expense) await updateExpense(expense.$id, data);
      else await addExpense(hogarId, { ...data, paidByName: userName });
      onAdded();
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
      <View className="rounded-t-[14px] absolute left-0 right-0 bottom-0 p-5" style={{ paddingBottom: 32 + kb, backgroundColor: t.bg }}>
        <Text className="text-[17px] font-semibold mb-4 text-label">{expense ? "Editar gasto" : "Nuevo gasto"}</Text>

        {items.length > 0 && (
          <>
            <Text className="text-[12px] font-medium uppercase tracking-wide text-secondary mb-2">
              Artículos del ticket ({items.length})
            </Text>
            <ScrollView className="bg-card rounded-lg2 mb-3" style={{ maxHeight: 170 }}>
              {items.map((it, i) => (
                <View
                  key={i}
                  className="flex-row items-center px-4 py-2.5"
                  style={{ gap: 10, borderTopWidth: i ? 0.5 : 0, borderTopColor: t.separator }}
                >
                  <View className="flex-1">
                    <Text className="text-[14px] text-label" numberOfLines={1}>{it.description}</Text>
                    {it.qty != null && it.qty > 1 && it.unitPrice != null && (
                      <Text className="text-[12px] text-secondary mt-0.5">
                        {it.qty} × {eur(it.unitPrice)}
                      </Text>
                    )}
                  </View>
                  <Text className="text-[14px] font-semibold text-label" style={{ fontVariant: ["tabular-nums"] }}>
                    {it.total != null ? eur(it.total) : it.unitPrice != null ? eur(it.unitPrice) : "—"}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </>
        )}
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

        {expense && onDelete && (
          <Pressable onPress={() => onDelete(expense.$id)} disabled={busy} className="mt-3 items-center py-2">
            <Text className="text-[15px] font-medium" style={{ color: t.red }}>Borrar gasto</Text>
          </Pressable>
        )}
      </View>
    </Modal>
  );
}
