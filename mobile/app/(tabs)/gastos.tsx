import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useQueryClient } from "@tanstack/react-query";
import { Screen } from "@/components/Screen";
import { Card, PhaseCard, cardShadow } from "@/components/Card";
import { AddFab, Avatar, IconTile, Money, SectionTitle } from "@/components/ui";
import { SwipeToDelete } from "@/components/SwipeToDelete";
import { ListGroup, Row } from "@/components/List";
import { SheetHeader } from "@/components/SheetHeader";
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
import { payingMembers } from "@/lib/members";
import { accountTotals, addExpense, balances, deleteExpense, effectiveAccount, equalSplits, expenseDate, expenseInvolves, expenseOwner, individualByPerson, parseExpenseItems, parseSplits, stringifySplits, updateExpense, type Account, type Expense, type ExpenseSplit } from "@/lib/expenses";
import { monthBalance, scheduleMonthSummary } from "@/lib/income";
import { saveIncome } from "@/lib/incomes";
import { useIncomes, useRefreshIncomes } from "@/lib/useIncomes";
import {
  budgetStatus,
  budgetTotals,
  getBudgetEnabled,
  normalizeName,
  setBudgetEnabled,
  type Category,
  type CategorySpend,
} from "@/lib/categories";
import { useTheme } from "@/theme/theme";
import { useKeyboardHeight } from "@/lib/useKeyboard";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];
const eur = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;
/** Ancho de la tarjeta de categoría del carrusel. */
const CAT_CARD_W = 152;
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
  const { data: settlements } = useSettlements(hogarId);
  // Solo cuentan para el dinero los miembros confirmados y con nombre.
  const memberNames = payingMembers(useMembers(hogarId).data ?? []);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [budgetOn, setBudgetOn] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [scanSource, setScanSource] = useState<"camera" | "library" | "pdf" | null>(null);
  const [filter, setFilter] = useState<"all" | Account>("all");
  const [catFilter, setCatFilter] = useState<string | null>(null);
  // Filtro "de quién": null = todo el hogar.
  const [who, setWho] = useState<string | null>(null);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
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
  // Gasto individual DE CADA UNO: se atribuye a su titular, no a quien lo pagó.
  const perPerson = individualByPerson(list, memberNames.length ? memberNames : [userName]);
  const people = Object.keys(perPerson).sort((a, b) => (a === userName ? -1 : b === userName ? 1 : a.localeCompare(b)));
  // Lo que sale del bolsillo de cada uno este mes: su parte de la cuenta
  // conjunta más lo que es suyo. Es la cifra que se descuenta de su ingreso.
  const myJointShare = members > 0 ? accTotals.joint / members : 0;
  const shareByPerson: Record<string, number> = {};
  for (const [name, own] of Object.entries(perPerson)) shareByPerson[name] = own + myJointShare;
  const byAccount = filter === "all" ? list : list.filter((e) => effectiveAccount(e) === filter);
  // Ojo: `budgetStatus` agrega por nombre normalizado y en minúsculas, así que
  // aquí hay que comparar igual. Si no, una tarjeta puede decir 80 € y la lista
  // salir vacía por una mayúscula o un espacio de más.
  const catKey = catFilter ? normalizeName(catFilter).toLowerCase() : null;
  const byCat = catKey
    ? byAccount.filter((e) => normalizeName(e.category ?? "").toLowerCase() === catKey)
    : byAccount;
  const movements = who ? byCat.filter((e) => expenseInvolves(e, who)) : byCat;

  const rows = budgetStatus(cats, list, monthDate);
  // Se muestran las categorías donde HA HABIDO gasto este mes, de mayor a menor.
  // Antes se listaban las que tenían presupuesto asignado, que es otra cosa: una
  // categoría con límite y cero gasto ocupaba sitio, y en la que más te has
  // gastado no salía por no tener límite puesto.
  const spentRows = rows.filter((r) => r.spent > 0).sort((a, b) => b.spent - a.spent);
  const totals = budgetTotals(rows);
  // Si la categoría filtrada deja de estar en pantalla (cambias de mes, o la
  // borras), el filtro se quedaba activo sin nada que lo indicara ni forma de
  // quitarlo: la lista salía vacía y parecía que no había gastos.
  // Se depende de un booleano y no de `spentRows`: el array es nuevo en cada
  // render y haría que el efecto se reevaluara sin parar para nada.
  const catFilterVisible = !catFilter || spentRows.some((r) => r.name === catFilter);
  useEffect(() => {
    if (!catFilterVisible) setCatFilter(null);
  }, [catFilterVisible]);
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
          style={{ width: 44, height: 44, backgroundColor: t.fill, marginBottom: 4 }}
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
          style={{ width: 44, height: 44, backgroundColor: t.fill }}
        >
          <Ionicons name="chevron-back" size={16} color={t.accent} />
        </Pressable>
        <View className="rounded-pill px-4 py-1.5" style={{ backgroundColor: t.fill }}>
          <Text className="text-subhead font-medium text-label">
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
            <Text className="text-footnote font-medium" style={{ color: t.accent }}>Hoy</Text>
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
        <Text className="text-center text-footnote mb-2" style={{ color: t.red }}>
          No se pudieron cargar los gastos. Desliza hacia abajo para reintentar.
        </Text>
      )}
      {/* Único número grande de la pantalla: el foco. Todo lo demás va a un
          nivel tipográfico por debajo, y el detalle por persona a una hoja
          aparte, que si no la pantalla se convierte en un muro de cifras. */}
      <Card>
        <Text className="text-caption1 text-secondary mb-1" style={{ textTransform: "uppercase", letterSpacing: 0.4 }}>
          Gastado · {monthLabel}
        </Text>
        <Text className="text-largeTitle text-label" style={{ fontVariant: ["tabular-nums"] }}>
          {eur(total)}
        </Text>
        {total > 0 && (
          <Pressable
            onPress={() => setBreakdownOpen(true)}
            className="flex-row items-center mt-3 pt-3"
            style={{ gap: 16, borderTopWidth: 0.5, borderTopColor: t.separator, minHeight: 44 }}
          >
            <View className="flex-1">
              <View className="flex-row items-center mb-0.5" style={{ gap: 7 }}>
                <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: t.accent }} />
                <Text className="text-footnote text-secondary">Conjunto</Text>
              </View>
              <Text className="text-headline font-semibold text-label" style={{ fontVariant: ["tabular-nums"] }}>
                {eur(accTotals.joint)}
              </Text>
            </View>
            <View className="flex-1">
              <View className="flex-row items-center mb-0.5" style={{ gap: 7 }}>
                <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: t.purple }} />
                <Text className="text-footnote text-secondary">Tuyo</Text>
              </View>
              <Text className="text-headline font-semibold text-label" style={{ fontVariant: ["tabular-nums"] }}>
                {eur(perPerson[userName] ?? 0)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={t.tabInactive} />
          </Pressable>
        )}
      </Card>

      <Modal visible={breakdownOpen} transparent animationType="slide" onRequestClose={() => setBreakdownOpen(false)}>
        <Pressable className="flex-1" style={{ backgroundColor: t.overlay }} onPress={() => setBreakdownOpen(false)} />
        <View
          className="rounded-t-sheet absolute left-0 right-0 bottom-0"
          style={{ maxHeight: "80%", paddingBottom: 24, backgroundColor: t.bg }}
        >
          <SheetHeader title={`Gasto de ${monthLabel}`} onClose={() => setBreakdownOpen(false)} closeLabel="Listo" />
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <View className="bg-card rounded-lg2 overflow-hidden mb-4">
              <View className="flex-row items-center px-4 py-3" style={{ gap: 10 }}>
                <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: t.accent }} />
                <Text className="flex-1 text-subhead text-label">Cuenta conjunta</Text>
                <Text className="text-subhead font-semibold text-label" style={{ fontVariant: ["tabular-nums"] }}>
                  {eur(accTotals.joint)}
                </Text>
              </View>
            </View>
            <Text className="text-caption1 font-medium uppercase tracking-wide text-secondary mb-2">
              Gasto individual de cada uno
            </Text>
            <View className="bg-card rounded-lg2 overflow-hidden">
              {people.map((p, i) => (
                <View
                  key={p}
                  className="flex-row items-center px-4 py-2.5"
                  style={{ gap: 10, borderTopWidth: i ? 0.5 : 0, borderTopColor: t.separator }}
                >
                  <Avatar name={p} size={26} />
                  <Text className="flex-1 text-subhead text-label" numberOfLines={1}>
                    {p}
                    {p === userName ? <Text className="text-secondary"> · tú</Text> : null}
                  </Text>
                  <Text className="text-subhead font-semibold text-label" style={{ fontVariant: ["tabular-nums"] }}>
                    {eur(perPerson[p] ?? 0)}
                  </Text>
                </View>
              ))}
            </View>
            <Text className="text-caption1 text-tertiary mt-3">
              Cada gasto cuenta para su titular, no para quien puso el dinero. Lo de la cuenta
              conjunta es dinero común y no se atribuye a nadie.
            </Text>
          </ScrollView>
        </View>
      </Modal>

      <IncomeCard
        hogarId={hogarId}
        userName={userName}
        spentByPerson={shareByPerson}
        joint={myJointShare}
        monthLabel={monthLabel}
      />

      <BudgetSection
        rows={spentRows}
        totals={totals}
        monthLabel={monthLabel}
        hasCategories={cats.length > 0}
        // La tarjeta grande solo tiene sentido si hay algún límite puesto: si no,
        // saldría un "0,00 € de 0,00 €" que no dice nada.
        showBudgetCard={budgetOn && totals.budget > 0}
        onManage={() => setBudgetOpen(true)}
        selected={catFilter}
        onSelect={setCatFilter}
      />

      {bal.length > 0 && (
        <>
          <SectionTitle>Quién debe a quién</SectionTitle>
          {bal
            .filter((b) => b.name !== userName)
            .map((b) => (
              <DebtCard
                key={b.name}
                hogarId={hogarId}
                userName={userName}
                name={b.name}
                net={b.net}
                onDone={refreshBal}
                expenses={all}
                settlements={settlements ?? []}
                members={members}
                memberNames={memberNames}
              />
            ))}
        </>
      )}

      <SectionTitle
        action={catFilter ? "Quitar filtro" : undefined}
        onAction={() => setCatFilter(null)}
      >
        {catFilter ? `Movimientos · ${catFilter}` : "Movimientos recientes"}
      </SectionTitle>
      {list.length > 0 && (
        <>
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { key: "all", label: "Todo" },
              { key: "joint", label: "Conjunta" },
              { key: "individual", label: "Individual" },
            ]}
          />
          {people.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mb-1"
              contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 8 }}
            >
              <Pressable
                onPress={() => setWho(null)}
                className="rounded-pill px-3 py-1.5"
                style={{ backgroundColor: who === null ? t.accent : t.fill }}
              >
                <Text className="text-footnote font-medium" style={{ color: who === null ? "#fff" : t.label }}>
                  Todo el hogar
                </Text>
              </Pressable>
              {people.map((p) => {
                const on = who === p;
                return (
                  <Pressable
                    key={p}
                    onPress={() => setWho(on ? null : p)}
                    className="flex-row items-center rounded-pill px-3 py-1.5"
                    style={{ gap: 6, backgroundColor: on ? t.accent : t.fill }}
                  >
                    <Avatar name={p} size={18} />
                    <Text className="text-footnote font-medium" style={{ color: on ? "#fff" : t.label }}>
                      {p === userName ? "Yo" : p}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </>
      )}
      {isLoading ? (
        <ActivityIndicator color={t.accent} style={{ marginTop: 16 }} />
      ) : movements.length === 0 ? (
        <Text className="text-center text-tertiary mt-6">
          {list.length === 0
            ? "Sin gastos todavía."
            : who
              ? `Sin movimientos de ${who === userName ? "los tuyos" : who} en esta cuenta.`
              : "Sin movimientos en esta cuenta."}
        </Text>
      ) : (
        <ListGroup>
          {movements.map((e, i) => {
            const joint = effectiveAccount(e) === "joint";
            const icon = joint ? "wallet" : e.shared ? "people" : "person";
            const color = joint ? t.accent : e.shared ? t.teal : t.gray;
            const owner = expenseOwner(e);
            // Si lo pagó uno y es de otro, hay que verlo de un vistazo en la lista.
            const source = joint
              ? "conjunta"
              : e.shared
                ? "compartido"
                : owner === e.paidByName
                  ? "personal"
                  : `de ${owner}`;
            return (
              <SwipeToDelete key={e.$id} onDelete={() => remove(e.$id)}>
                <Row
                  first={i === 0}
                  leading={<IconTile icon={icon} color={color} />}
                  leadingWidth={32}
                  title={e.concept}
                  subtitle={`${e.paidByName} · ${source}${e.category ? ` · ${e.category}` : ""}`}
                  trailing={
                    <Money size={15} weight="500" color={t.red}>
                      −{eur(e.amount)}
                    </Money>
                  }
                  onPress={() => setEditing(e)}
                />
              </SwipeToDelete>
            );
          })}
        </ListGroup>
      )}
      <Text className="text-center text-caption1 text-tertiary mb-2">Toca un gasto para editarlo · desliza para borrarlo</Text>

      <AddExpense visible={open} onClose={() => setOpen(false)} hogarId={hogarId} userName={userName} categories={cats} memberNames={memberNames} householdSize={members} onAdded={refresh} />
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
        memberNames={memberNames}
        householdSize={members}
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

/**
 * "Me entran X, llevo gastado Y, me quedan Z" con barra de progreso, y debajo
 * lo mismo del resto del hogar.
 *
 * Cada uno tiene su ingreso y solo puede tocar el suyo, pero todos los ven: son
 * dos personas repartiendo gastos, y sin saber lo que entra en cada lado no se
 * puede decidir nada. A cada uno se le descuenta su parte de la cuenta conjunta
 * más sus gastos individuales.
 *
 * El resumen de fin de mes se reprograma cada vez que cambia el gasto, porque
 * una notificación local congela su texto al programarla.
 */
function IncomeCard({
  hogarId,
  userName,
  spentByPerson,
  joint,
  monthLabel,
}: {
  hogarId: string;
  userName: string;
  /** Lo que sale del bolsillo de cada uno: su parte de la conjunta + lo suyo. */
  spentByPerson: Record<string, number>;
  /** Parte de la cuenta conjunta que le toca a cada uno. */
  joint: number;
  monthLabel: string;
}) {
  const t = useTheme();
  const kb = useKeyboardHeight();
  const incomes = useIncomes(hogarId, userName).data ?? {};
  const refreshIncomes = useRefreshIncomes(hogarId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const income = incomes[userName] ?? 0;
  const spent = spentByPerson[userName] ?? 0;
  const others = Object.keys(spentByPerson)
    .filter((n) => n !== userName && (incomes[n] ?? 0) > 0)
    .sort();

  useEffect(() => {
    scheduleMonthSummary(hogarId, income, spent).catch(() => undefined);
  }, [hogarId, income, spent]);

  const save = async () => {
    const v = parseFloat(draft.replace(",", ".").replace(/[^\d.]/g, ""));
    setEditing(false);
    await saveIncome(hogarId, userName, Number.isFinite(v) && v > 0 ? v : 0).catch(() => undefined);
    await refreshIncomes();
  };

  const open = () => {
    setDraft(income > 0 ? String(income).replace(".", ",") : "");
    setEditing(true);
  };

  const b = monthBalance(income, spent);

  return (
    <>
      {income <= 0 ? (
        <Pressable
          onPress={open}
          className="bg-card rounded-lg2 mx-4 mb-3 px-4 py-3 flex-row items-center"
          style={{ gap: 12, ...cardShadow(t.dark) }}
        >
          <View className="rounded-lg items-center justify-center" style={{ width: 30, height: 30, backgroundColor: t.green }}>
            <Ionicons name="trending-up" size={16} color="#fff" />
          </View>
          <Text className="flex-1 text-subhead text-secondary">
            Pon tu ingreso mensual y verás cuánto te queda
          </Text>
          <Ionicons name="chevron-forward" size={16} color={t.tabInactive} />
        </Pressable>
      ) : (
        <Pressable onPress={open} className="bg-card rounded-card mx-4 mb-3 p-4" style={cardShadow(t.dark)}>
          <View className="flex-row items-end justify-between mb-3">
            <View>
              <Text className="text-caption1 text-secondary mb-1" style={{ textTransform: "uppercase", letterSpacing: 0.4 }}>
                Te queda · {monthLabel}
              </Text>
              {/* Un nivel por debajo del "Gastado": en la pantalla solo puede
                  haber un número protagonista. */}
              <Text
                className="text-title2 font-bold"
                style={{ letterSpacing: -0.5, fontVariant: ["tabular-nums"], color: b.over ? t.red : t.label }}
              >
                {b.over ? `−${eur(-b.left)}` : eur(b.left)}
              </Text>
            </View>
            <View className="items-end">
              <Text className="text-subhead text-secondary">de {eur(income)}</Text>
              <Text className="text-caption1 text-tertiary mt-0.5">tu ingreso · toca para cambiar</Text>
            </View>
          </View>
          <ProgressBar pct={b.pct} color={b.over ? t.red : b.pct >= 0.85 ? t.orange : t.green} />
          <Text className="text-caption1 text-secondary mt-2">
            {`Llevas ${eur(spent)}`}
            {joint > 0.005 ? ` (${eur(joint)} de tu parte de la conjunta)` : ""}
            {b.over ? `: te has pasado ${eur(-b.left)}.` : "."}
          </Text>

          {others.length > 0 && (
            <View className="mt-3 pt-3" style={{ borderTopWidth: 0.5, borderTopColor: t.separator }}>
              {others.map((n) => {
                const ob = monthBalance(incomes[n] ?? 0, spentByPerson[n] ?? 0);
                return (
                  <View key={n} className="flex-row items-center py-1" style={{ gap: 8 }}>
                    <Avatar name={n} size={20} />
                    <Text className="flex-1 text-subhead text-label" numberOfLines={1}>{n}</Text>
                    <Text className="text-caption1 text-tertiary mr-2">de {eur(ob.income)}</Text>
                    <Text
                      className="text-subhead font-semibold"
                      style={{ color: ob.over ? t.red : t.label, fontVariant: ["tabular-nums"] }}
                    >
                      {ob.over ? `−${eur(-ob.left)}` : eur(ob.left)}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </Pressable>
      )}

      <Modal visible={editing} transparent animationType="slide" onRequestClose={() => setEditing(false)}>
        <Pressable className="flex-1" style={{ backgroundColor: t.overlay }} onPress={() => setEditing(false)} />
        <View className="rounded-t-sheet absolute left-0 right-0 bottom-0" style={{ paddingBottom: 32 + kb, backgroundColor: t.bg }}>
          <SheetHeader
            title="Ingreso mensual"
            onClose={() => setEditing(false)}
            onSave={save}
            dirty={draft !== (income > 0 ? String(income).replace(".", ",") : "")}
          />
          <View className="p-5">
            <TextInput
              className="bg-card rounded-lg2 px-4 py-3 mb-3 text-callout text-label"
              placeholder="Lo que te entra al mes (€)"
              placeholderTextColor={t.labelTertiary}
              value={draft}
              onChangeText={setDraft}
              keyboardType="decimal-pad"
              autoFocus
            />
            <Text className="text-caption1 text-tertiary">
              Cada uno pone el suyo y lo ve todo el hogar. Se le descuenta tu parte de la cuenta
              conjunta más tus gastos individuales. A final de mes recibirás un aviso con lo que
              hayas conseguido ahorrar. Déjalo vacío para quitarlo.
            </Text>
          </View>
        </View>
      </Modal>
    </>
  );
}

function BudgetSection({
  rows,
  totals,
  monthLabel,
  hasCategories,
  showBudgetCard,
  onManage,
  selected,
  onSelect,
}: {
  /** Categorías CON gasto este mes, de mayor a menor. */
  rows: CategorySpend[];
  totals: { budget: number; spent: number };
  monthLabel: string;
  hasCategories: boolean;
  /** Hay algún límite puesto: se pinta la tarjeta grande de presupuesto. */
  showBudgetCard: boolean;
  onManage: () => void;
  /** Categoría por la que se están filtrando los movimientos. */
  selected: string | null;
  onSelect: (name: string | null) => void;
}) {
  const t = useTheme();
  const stateColor = (s: CategorySpend["state"]) => (s === "over" ? t.red : s === "warn" ? t.orange : t.accent);
  // Sin límite no hay porcentaje que enseñar, así que la barra compara con la
  // categoría en la que más se ha gastado. Da la misma lectura de un vistazo
  // ("en esto es donde se va el dinero") sin inventarse un presupuesto.
  const maxSpent = rows.reduce((m, r) => Math.max(m, r.spent), 0);

  // La tarjeta grande se calcula antes del corte por lista vacía: si no, un mes
  // sin gastos con categoría escondía también el presupuesto, y quien tiene
  // límites puestos dejaba de ver cuánto le queda justo cuando más sirve.
  const totalPct = totals.budget > 0 ? totals.spent / totals.budget : 0;
  const totalCol = totals.spent > totals.budget ? t.red : totalPct >= 0.85 ? t.orange : t.accent;
  const remaining = totals.budget - totals.spent;
  const budgetCard = showBudgetCard ? (
    <View className="bg-card rounded-card mx-4 mb-3 p-4" style={cardShadow(t.dark)}>
      <View className="flex-row items-end justify-between mb-3.5">
        <View>
          <Text className="text-caption1 text-secondary mb-1" style={{ textTransform: "uppercase", letterSpacing: 0.4 }}>
            Presupuesto · {monthLabel}
          </Text>
          <Text className="text-title2 font-bold text-label" style={{ letterSpacing: -0.5, fontVariant: ["tabular-nums"] }}>
            {eur(totals.spent)}
          </Text>
        </View>
        <Text className="text-subhead text-secondary mb-1">de {eur(totals.budget)}</Text>
      </View>
      <ProgressBar pct={totalPct} color={totalCol} />
      <View className="flex-row justify-between mt-2">
        <Text className="text-caption1 text-secondary">{Math.round(totalPct * 100)}% usado</Text>
        <Text className="text-caption1" style={{ color: remaining < 0 ? t.red : t.labelSecondary }}>
          {remaining >= 0 ? `${eur(remaining)} restantes` : `${eur(-remaining)} de más`}
        </Text>
      </View>
    </View>
  ) : null;

  if (rows.length === 0) {
    return (
      <>
        {budgetCard}
        <SectionTitle>Por categoría · {monthLabel}</SectionTitle>
        <Pressable onPress={onManage} className="bg-card rounded-lg2 mx-4 mb-3 px-4 py-3 flex-row items-center" style={{ gap: 12, ...cardShadow(t.dark) }}>
          <View className="rounded-lg items-center justify-center" style={{ width: 30, height: 30, backgroundColor: t.accent }}>
            <Ionicons name="pie-chart" size={16} color="#fff" />
          </View>
          <Text className="flex-1 text-subhead text-secondary">
            {hasCategories
              ? "Sin gasto por categoría este mes. Ponle categoría a un gasto y aparecerá aquí."
              : "Crea categorías para ver en qué se te va el dinero"}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={t.tabInactive} />
        </Pressable>
      </>
    );
  }

  return (
    <>
      {budgetCard}

      <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
        <Text
          className="text-footnote font-medium"
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
          <Text className="text-footnote font-semibold" style={{ color: t.accent }}>Editar</Text>
        </Pressable>
      </View>
      {/* Carrusel horizontal: la rejilla de dos columnas crecía hacia abajo y con
          seis categorías se comía la pantalla entera. En horizontal ocupa una
          fila fija, se recorre deslizando y la siguiente tarjeta asoma para que
          se vea que hay más. El paso del snap incluye la separación, si no el
          carrusel se va desalineando tarjeta a tarjeta. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CAT_CARD_W + 10}
        decelerationRate="fast"
        // paddingVertical y no solo abajo: cardShadow usa un radio de 10 y sin
        // holgura arriba la sombra se recorta y la tira se ve cortada.
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 4, gap: 10 }}
      >
        {rows.map((r) => {
          const col = r.hasBudget ? stateColor(r.state) : r.color;
          const on = selected === r.name;
          // Con límite, la barra es el % consumido. Sin él, cuánto pesa esta
          // categoría frente a la que más se lleva este mes.
          const pct = r.hasBudget ? r.pct : maxSpent > 0 ? r.spent / maxSpent : 0;
          return (
            <Pressable
              key={r.$id}
              onPress={() => onSelect(on ? null : r.name)}
              className="bg-card rounded-lg2 p-3"
              style={{
                width: CAT_CARD_W,
                borderWidth: on ? 1.5 : 0,
                borderColor: on ? r.color : "transparent",
                ...cardShadow(t.dark),
              }}
            >
              <View className="flex-row items-center mb-2" style={{ gap: 8 }}>
                <View className="rounded-md items-center justify-center" style={{ width: 24, height: 24, backgroundColor: r.color }}>
                  <Ionicons name={r.icon as IoniconName} size={13} color="#fff" />
                </View>
                <Text className="text-footnote font-medium text-label" numberOfLines={1} style={{ flex: 1 }}>{r.name}</Text>
              </View>
              <Text className="text-subhead font-semibold text-label mb-1.5" style={{ fontVariant: ["tabular-nums"], letterSpacing: -0.2 }}>
                {eur(r.spent)}
                {r.hasBudget ? (
                  <Text className="text-caption1 text-secondary font-normal"> / {eur(r.budget)}</Text>
                ) : null}
              </Text>
              <ProgressBar pct={pct} color={col} />
              {!r.hasBudget && (
                <Text className="text-caption2 text-tertiary mt-1.5" numberOfLines={1}>
                  sin límite
                </Text>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </>
  );
}

/** Fila de personas del hogar en chips (quién pagó / de quién es el gasto). */
function PeopleRow({ people, value, onChange }: { people: string[]; value: string; onChange: (n: string) => void }) {
  const t = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4" contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
      {people.map((p) => {
        const on = p === value;
        return (
          <Pressable
            key={p}
            onPress={() => onChange(p)}
            className="flex-row items-center rounded-pill px-3 py-2"
            style={{ gap: 6, backgroundColor: on ? t.accent : t.fill }}
          >
            <Avatar name={p} size={18} />
            <Text className="text-footnote font-medium" style={{ color: on ? "#fff" : t.label }}>{p}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
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
  memberNames,
  householdSize,
  expense = null,
  onDelete,
}: {
  visible: boolean;
  onClose: () => void;
  hogarId: string;
  userName: string;
  categories: Category[];
  onAdded: () => void;
  /** Nombres de los miembros, para el reparto por porcentajes. */
  memberNames: string[];
  /** Cuánta gente hay en el hogar según Appwrite (aunque no sepamos su nombre). */
  householdSize: number;
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
  // Quién puso el dinero y de quién es el gasto (pueden ser personas distintas).
  const [paidBy, setPaidBy] = useState(userName);
  const [forWho, setForWho] = useState(userName);
  // Reparto por porcentajes: null = a partes iguales.
  const [splits, setSplits] = useState<ExpenseSplit[] | null>(null);
  const items = parseExpenseItems(expense?.items);
  // Siempre me incluyo: si aún no se han cargado los miembros, al menos estoy yo.
  const everyone = [...new Set([userName, ...memberNames].filter((n) => n && n.trim()))];
  const splitTotal = (splits ?? []).reduce((s, x) => s + x.pct, 0);
  const splitsOk = splits === null || Math.abs(splitTotal - 100) < 0.01;
  // ¿Cambió algo respecto a lo que había al abrir?
  const dirty = expense
    ? amount.replace(",", ".") !== String(expense.amount) ||
      concept !== expense.concept ||
      shared !== expense.shared ||
      account !== effectiveAccount(expense) ||
      paidBy !== expense.paidByName ||
      forWho !== expenseOwner(expense) ||
      (category ?? null) !== (expense.category ?? null)
    : amount.trim().length > 0 || concept.trim().length > 0;

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
      setPaidBy(expense.paidByName);
      setForWho(expenseOwner(expense));
      const sp = parseSplits(expense.splits);
      setSplits(sp.length ? sp : null);
    } else {
      setAmount("");
      setConcept("");
      setShared(true);
      setAccount("joint");
      setCategory(null);
      setDate(new Date());
      setPaidBy(userName);
      setForWho(userName);
      setSplits(null);
    }
  }, [visible, expense, userName]);

  const submit = async () => {
    const value = parseFloat(amount.replace(",", "."));
    if (!isFinite(value) || value <= 0 || !concept.trim()) return;
    setBusy(true);
    try {
      const isShared = account === "joint" ? true : shared;
      const data = {
        amount: value,
        concept: concept.trim(),
        account,
        shared: isShared,
        category: category ?? undefined,
        spentAt: date.toISOString(),
        paidByName: paidBy,
        // Solo tiene sentido repartir un gasto individual compartido.
        splits: account === "individual" && shared ? stringifySplits(splits ?? []) : null,
        // El titular solo importa en el individual NO compartido; en el resto se
        // guarda null para que un gasto editado no arrastre un dueño antiguo.
        forName: account === "individual" && !isShared ? forWho : null,
      };
      if (expense) await updateExpense(expense.$id, data);
      else await addExpense(hogarId, data);
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
      <View className="rounded-t-sheet absolute left-0 right-0 bottom-0" style={{ paddingBottom: 32 + kb, backgroundColor: t.bg }}>
        <SheetHeader
          title={expense ? "Editar gasto" : "Nuevo gasto"}
          onClose={onClose}
          onSave={submit}
          dirty={dirty}
          saving={busy}
          saveDisabled={!concept.trim() || !amount.trim() || !splitsOk}
        />
        <ScrollView contentContainerStyle={{ padding: 20 }}>

        {items.length > 0 && (
          <>
            <Text className="text-caption1 font-medium uppercase tracking-wide text-secondary mb-2">
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
                    <Text className="text-subhead text-label" numberOfLines={1}>{it.description}</Text>
                    {it.qty != null && it.qty > 1 && it.unitPrice != null && (
                      <Text className="text-caption1 text-secondary mt-0.5">
                        {it.qty} × {eur(it.unitPrice)}
                      </Text>
                    )}
                  </View>
                  <Text className="text-subhead font-semibold text-label" style={{ fontVariant: ["tabular-nums"] }}>
                    {it.total != null ? eur(it.total) : it.unitPrice != null ? eur(it.unitPrice) : "—"}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </>
        )}
        <TextInput
          className="bg-card rounded-lg2 px-4 py-3 mb-3 text-callout text-label"
          placeholder="Importe (€)"
          placeholderTextColor={t.labelTertiary}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
        />
        <TextInput
          className="bg-card rounded-lg2 px-4 py-3 mb-3 text-callout text-label"
          placeholder="Concepto"
          placeholderTextColor={t.labelTertiary}
          value={concept}
          onChangeText={setConcept}
        />

        <Pressable onPress={() => setShowDate(true)} className="bg-card rounded-lg2 px-4 py-3 mb-3 flex-row items-center" style={{ gap: 10 }}>
          <Ionicons name="calendar-outline" size={18} color={t.accent} />
          <Text className="flex-1 text-callout text-label">Fecha</Text>
          <Text className="text-subhead text-secondary">
            {`${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`}
          </Text>
        </Pressable>
        {showDate && (
          <DateTimePicker value={date} mode="date" onChange={onPickDate} display={Platform.OS === "ios" ? "spinner" : "default"} />
        )}

        {categories.length > 0 && (
          <>
            <Text className="text-caption1 font-medium uppercase tracking-wide text-secondary mb-2">Categoría</Text>
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
                    <Text className="text-footnote font-medium" style={{ color: on ? "#fff" : t.label }}>{c.name}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        )}

        {everyone.length > 1 ? (
          <>
            <Text className="text-caption1 font-medium uppercase tracking-wide text-secondary mb-2">Lo pagó</Text>
            <PeopleRow people={everyone} value={paidBy} onChange={setPaidBy} />
          </>
        ) : householdSize > 1 ? (
          // Se sabe que el hogar tiene más gente, pero no cómo se llama: sin
          // nombre no se puede asignar ni repartir. Mejor decirlo que esconder
          // los controles y que parezca que la función no existe.
          <View className="bg-card rounded-lg2 px-4 py-3 mb-4 flex-row items-center" style={{ gap: 10 }}>
            <Ionicons name="information-circle-outline" size={18} color={t.orange} />
            <Text className="flex-1 text-caption1 text-secondary">
              Para asignar el gasto a otra persona o repartirlo por porcentajes, la otra persona del
              hogar tiene que abrir esta versión de la app al menos una vez.
            </Text>
          </View>
        ) : null}

        <Text className="text-caption1 font-medium uppercase tracking-wide text-secondary mb-2">Cuenta</Text>
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
                <Text className="text-subhead font-medium" style={{ color: on ? "#fff" : t.label }}>{o.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {account === "individual" && (
          <View className="flex-row items-center justify-between bg-card rounded-lg2 px-4 py-3 mb-4">
            <View className="flex-1 pr-3">
              <Text className="text-subhead text-label">Compartido con el hogar</Text>
              <Text className="text-caption1 text-secondary mt-0.5">Los demás te devuelven su parte</Text>
            </View>
            <Switch value={shared} onValueChange={setShared} trackColor={{ true: t.accent, false: t.separator }} />
          </View>
        )}

        {account === "individual" && !shared && everyone.length > 1 && (
          <>
            <Text className="text-caption1 font-medium uppercase tracking-wide text-secondary mb-2">De quién es</Text>
            <PeopleRow people={everyone} value={forWho} onChange={setForWho} />
            {forWho !== paidBy && (
              <Text className="text-caption1 mb-4" style={{ color: t.orange }}>
                Lo pagó {paidBy} pero es de {forWho}: {forWho} se lo debe.
              </Text>
            )}
          </>
        )}

        {account === "individual" && shared && everyone.length > 1 && (
          <>
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-caption1 font-medium uppercase tracking-wide text-secondary">Reparto</Text>
              <Pressable
                onPress={() => setSplits(splits ? null : equalSplits(memberNames))}
                hitSlop={8}
              >
                <Text className="text-footnote font-medium" style={{ color: t.accent }}>
                  {splits ? "A partes iguales" : "Por porcentaje"}
                </Text>
              </Pressable>
            </View>

            {splits ? (
              <View className="bg-card rounded-lg2 mb-4 overflow-hidden">
                {splits.map((sp, i) => (
                  <View
                    key={sp.name}
                    className="flex-row items-center px-4 py-2.5"
                    style={{ gap: 10, borderTopWidth: i ? 0.5 : 0, borderTopColor: t.separator }}
                  >
                    <Text className="flex-1 text-subhead text-label" numberOfLines={1}>{sp.name}</Text>
                    <TextInput
                      className="text-callout text-label text-right"
                      style={{ minWidth: 54 }}
                      value={String(sp.pct)}
                      onChangeText={(v) => {
                        const n = parseFloat(v.replace(",", "."));
                        setSplits((prev) =>
                          (prev ?? []).map((x, j) =>
                            j === i ? { ...x, pct: isFinite(n) ? n : 0 } : x,
                          ),
                        );
                      }}
                      keyboardType="decimal-pad"
                      selectTextOnFocus
                    />
                    <Text className="text-subhead text-secondary">%</Text>
                    <Text className="text-caption1 text-tertiary" style={{ minWidth: 62, textAlign: "right" }}>
                      {eur((parseFloat(amount.replace(",", ".")) || 0) * sp.pct / 100)}
                    </Text>
                  </View>
                ))}
                <View
                  className="flex-row items-center px-4 py-2"
                  style={{ borderTopWidth: 0.5, borderTopColor: t.separator }}
                >
                  <Text className="flex-1 text-caption1 text-secondary">Total</Text>
                  <Text
                    className="text-footnote font-semibold"
                    style={{ color: splitsOk ? t.green : t.red }}
                  >
                    {splitTotal.toFixed(0)} % {splitsOk ? "" : "· debe sumar 100"}
                  </Text>
                </View>
              </View>
            ) : (
              <Text className="text-caption1 text-tertiary mb-4">
                Se reparte a partes iguales entre {memberNames.length} personas.
              </Text>
            )}
          </>
        )}
        {expense && onDelete && (
          <Pressable onPress={() => onDelete(expense.$id)} disabled={busy} className="mt-2 items-center py-2">
            <Text className="text-subhead font-medium" style={{ color: t.red }}>Borrar gasto</Text>
          </Pressable>
        )}
        </ScrollView>
      </View>
    </Modal>
  );
}
