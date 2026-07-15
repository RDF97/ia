import { useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { useTheme } from "@/theme/theme";
import { Toggle } from "@/components/Toggle";
import {
  guessMapping,
  latin1FromBase64,
  looksMojibake,
  parseBankRows,
  parseCsv,
  type BankMovement,
  type CsvMapping,
} from "@/lib/csv";
import { reconcile, reconSummary, type ReconMovement } from "@/lib/reconcile";
import { addExpense, type Account, type Expense } from "@/lib/expenses";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];
const eur = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;
const shortDate = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
};

type Step = "pick" | "map" | "review";

/** Lee el CSV como UTF-8 y, si detecta bytes inválidos, reintenta como latin-1. */
async function readCsvText(asset: DocumentPicker.DocumentPickerAsset): Promise<string> {
  const webFile = (asset as unknown as { file?: { text?: () => Promise<string> } }).file;
  if (webFile?.text) return webFile.text();
  const f = new File(asset.uri);
  const utf8 = await f.text();
  if (!looksMojibake(utf8)) return utf8;
  return latin1FromBase64(await f.base64());
}

export function CsvModal({
  visible,
  hogarId,
  userName,
  expenses,
  onClose,
  onImported,
}: {
  visible: boolean;
  hogarId: string;
  userName: string;
  expenses: Expense[];
  onClose: () => void;
  onImported: () => void;
}) {
  const t = useTheme();
  const [step, setStep] = useState<Step>("pick");
  const [rows, setRows] = useState<string[][]>([]);
  const [hasHeader, setHasHeader] = useState(true);
  const [mapping, setMapping] = useState<CsvMapping>({ date: 0, concept: 1, amount: 2 });
  const [recon, setRecon] = useState<ReconMovement[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [account, setAccount] = useState<Account>("individual");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setStep("pick");
    setRows([]);
    setRecon([]);
    setSelected(new Set());
    setAccount("individual");
  };
  const close = () => {
    reset();
    onClose();
  };

  const pick = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["text/csv", "text/comma-separated-values", "application/vnd.ms-excel", "text/plain", "*/*"],
        copyToCacheDirectory: true,
      });
      if (res.canceled) return;
      const asset = res.assets[0];
      const text = await readCsvText(asset);
      const parsed = parseCsv(text);
      if (parsed.length === 0) {
        Alert.alert("Archivo vacío", "No se han encontrado filas en el CSV.");
        return;
      }
      const guess = guessMapping(parsed[0]);
      setRows(parsed);
      setHasHeader(Object.keys(guess).length >= 2);
      setMapping({ date: guess.date ?? 0, concept: guess.concept ?? 1, amount: guess.amount ?? 2 });
      setStep("map");
    } catch (e) {
      Alert.alert("No se pudo leer el archivo", e instanceof Error ? e.message : "Inténtalo de nuevo.");
    }
  };

  const cols = rows[0]?.length ?? 0;
  const headerLabel = (i: number) => (hasHeader ? rows[0]?.[i] || `Columna ${i + 1}` : `Columna ${i + 1}`);
  const sampleRow = hasHeader ? rows[1] : rows[0];

  const toReview = () => {
    const movs: BankMovement[] = parseBankRows(rows, mapping, hasHeader);
    if (movs.length === 0) {
      Alert.alert("Sin movimientos", "No se han podido leer fechas e importes con estas columnas. Revisa el mapeo.");
      return;
    }
    const r = reconcile(movs, expenses, 3);
    setRecon(r);
    // por defecto, marcamos para importar todos los cargos que faltan
    const miss = new Set<number>();
    r.forEach((m, i) => {
      if (!m.income && !m.matchedId) miss.add(i);
    });
    setSelected(miss);
    setStep("review");
  };

  const toggleSel = (i: number) => {
    const next = new Set(selected);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setSelected(next);
  };

  const importSelected = async () => {
    const toImport = [...selected].map((i) => recon[i]).filter((m) => m && !m.income && !m.matchedId);
    if (toImport.length === 0) return;
    setBusy(true);
    try {
      for (const m of toImport) {
        await addExpense(hogarId, {
          amount: Math.abs(m.amount),
          concept: m.concept,
          paidByName: userName,
          account,
          shared: account === "joint",
          spentAt: m.date,
        });
      }
      onImported();
      Alert.alert("Importado", `${toImport.length} ${toImport.length === 1 ? "gasto añadido" : "gastos añadidos"}.`);
      close();
    } catch (e) {
      Alert.alert("No se pudo importar", e instanceof Error ? e.message : "Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  const summary = recon.length ? reconSummary(recon) : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable className="flex-1" style={{ backgroundColor: t.overlay }} onPress={close} />
      <View className="rounded-t-[14px] absolute left-0 right-0 bottom-0" style={{ height: "88%", backgroundColor: t.bg }}>
        <View className="flex-row items-center justify-between px-5 py-3" style={{ borderBottomWidth: 0.5, borderBottomColor: t.separator }}>
          {step === "pick" ? (
            <Pressable onPress={close} hitSlop={8}><Text className="text-base text-accent">Cerrar</Text></Pressable>
          ) : (
            <Pressable onPress={() => setStep(step === "review" ? "map" : "pick")} hitSlop={8}>
              <Text className="text-base text-accent">‹ Atrás</Text>
            </Pressable>
          )}
          <Text className="text-[17px] font-semibold text-label">Conciliar CSV</Text>
          <View style={{ width: 52 }} />
        </View>

        {step === "pick" && (
          <View className="px-6 pt-8 items-center">
            <View className="rounded-full items-center justify-center mb-4" style={{ width: 64, height: 64, backgroundColor: t.accentSoft }}>
              <Ionicons name="document-text-outline" size={30} color={t.accent} />
            </View>
            <Text className="text-[17px] font-semibold text-label text-center mb-2">Importa el CSV de tu banco</Text>
            <Text className="text-[14px] text-secondary text-center mb-6">
              Casamos cada movimiento con tus gastos por importe y fecha, te marcamos los que faltan por
              registrar y los añades de un toque.
            </Text>
            <Pressable onPress={pick} className="rounded-[14px] py-3.5 px-6 items-center flex-row" style={{ backgroundColor: t.accent, gap: 8 }}>
              <Ionicons name="folder-open-outline" size={18} color="#fff" />
              <Text className="text-white text-base font-semibold">Elegir archivo CSV</Text>
            </Pressable>
          </View>
        )}

        {step === "map" && (
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }}>
            <View className="bg-card rounded-lg2 px-4 py-3 mb-4 flex-row items-center" style={{ gap: 12 }}>
              <Text className="flex-1 text-[15px] text-label">La primera fila es cabecera</Text>
              <Toggle value={hasHeader} onChange={setHasHeader} />
            </View>
            <Text className="text-[13px] text-secondary mb-4">
              Elige qué columna es cada una ({rows.length - (hasHeader ? 1 : 0)} filas de datos).
            </Text>
            {([
              { key: "date", label: "Fecha", icon: "calendar-outline" },
              { key: "concept", label: "Concepto", icon: "text-outline" },
              { key: "amount", label: "Importe", icon: "cash-outline" },
            ] as const).map((f) => (
              <View key={f.key} className="mb-4">
                <View className="flex-row items-center mb-2" style={{ gap: 6 }}>
                  <Ionicons name={f.icon as IoniconName} size={15} color={t.accent} />
                  <Text className="text-[13px] font-medium uppercase tracking-wide text-secondary">{f.label}</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
                  {Array.from({ length: cols }).map((_, i) => {
                    const on = mapping[f.key] === i;
                    return (
                      <Pressable
                        key={i}
                        onPress={() => setMapping({ ...mapping, [f.key]: i })}
                        className="rounded-lg2 px-3 py-2"
                        style={{ backgroundColor: on ? t.accent : t.card, borderWidth: 1, borderColor: on ? t.accent : t.separator, minWidth: 92 }}
                      >
                        <Text className="text-[12px] font-medium" numberOfLines={1} style={{ color: on ? "#fff" : t.label }}>
                          {headerLabel(i)}
                        </Text>
                        <Text className="text-[11px]" numberOfLines={1} style={{ color: on ? "#ffffffcc" : t.labelTertiary }}>
                          {sampleRow?.[i] ?? ""}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ))}
            <Pressable onPress={toReview} className="rounded-[14px] py-3.5 items-center mt-2" style={{ backgroundColor: t.accent }}>
              <Text className="text-white text-base font-semibold">Conciliar</Text>
            </Pressable>
          </ScrollView>
        )}

        {step === "review" && (
          <View className="flex-1">
            {summary && (
              <View className="flex-row px-4 pt-3 pb-1" style={{ gap: 8 }}>
                <Pill color={t.green} label={`${summary.matched} registrados`} />
                <Pill color={t.orange} label={`${summary.missing} faltan`} />
                {summary.income > 0 && <Pill color={t.labelSecondary} label={`${summary.income} abonos`} />}
              </View>
            )}
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 12 }}>
              {recon.map((m, i) => {
                const status: "matched" | "missing" | "income" = m.income ? "income" : m.matchedId ? "matched" : "missing";
                const on = selected.has(i);
                return (
                  <Pressable
                    key={i}
                    disabled={status !== "missing"}
                    onPress={() => toggleSel(i)}
                    className="flex-row items-center bg-card rounded-lg2 px-3 py-2.5 mb-2"
                    style={{ gap: 10, opacity: status === "income" ? 0.5 : 1 }}
                  >
                    {status === "missing" ? (
                      <View className="items-center justify-center rounded-md" style={{ width: 22, height: 22, borderWidth: 1.8, borderColor: on ? t.accent : t.separator, backgroundColor: on ? t.accent : "transparent" }}>
                        {on && <Ionicons name="checkmark" size={14} color="#fff" />}
                      </View>
                    ) : (
                      <Ionicons
                        name={status === "matched" ? "checkmark-circle" : "arrow-down-circle-outline"}
                        size={22}
                        color={status === "matched" ? t.green : t.labelTertiary}
                      />
                    )}
                    <View className="flex-1">
                      <Text className="text-[15px] text-label" numberOfLines={1}>{m.concept}</Text>
                      <Text className="text-[12px] text-secondary">
                        {shortDate(m.date)} · {status === "matched" ? "ya registrado" : status === "income" ? "abono (ignorado)" : "falta por registrar"}
                      </Text>
                    </View>
                    <Text className="text-[14px] font-semibold" style={{ color: m.income ? t.green : t.label, fontVariant: ["tabular-nums"] }}>
                      {m.income ? "+" : "−"}{eur(Math.abs(m.amount))}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View className="px-4 pt-2 pb-6" style={{ borderTopWidth: 0.5, borderTopColor: t.separator }}>
              <View className="flex-row mb-3" style={{ gap: 8 }}>
                {([
                  { key: "individual", label: "Individual", icon: "person" },
                  { key: "joint", label: "Conjunta", icon: "wallet" },
                ] as const).map((o) => {
                  const on = account === o.key;
                  return (
                    <Pressable key={o.key} onPress={() => setAccount(o.key)} className="flex-1 flex-row items-center justify-center rounded-lg2 py-2.5" style={{ gap: 6, backgroundColor: on ? t.accent : t.card, borderWidth: 1, borderColor: on ? t.accent : t.separator }}>
                      <Ionicons name={o.icon} size={15} color={on ? "#fff" : t.labelSecondary} />
                      <Text className="text-[14px] font-medium" style={{ color: on ? "#fff" : t.label }}>{o.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable
                onPress={importSelected}
                disabled={busy || selected.size === 0}
                className="rounded-[14px] py-3.5 items-center"
                style={{ backgroundColor: t.accent, opacity: busy || selected.size === 0 ? 0.5 : 1 }}
              >
                {busy ? <ActivityIndicator color="#fff" /> : <Text className="text-white text-base font-semibold">Importar {selected.size} {selected.size === 1 ? "gasto" : "gastos"}</Text>}
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

function Pill({ color, label }: { color: string; label: string }) {
  return (
    <View className="flex-row items-center rounded-pill px-2.5 py-1" style={{ gap: 5, backgroundColor: color + "22" }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />
      <Text className="text-[12px] font-medium" style={{ color }}>{label}</Text>
    </View>
  );
}
