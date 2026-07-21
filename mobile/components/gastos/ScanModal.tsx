import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { useTheme } from "@/theme/theme";
import { hSelect } from "@/lib/haptics";
import { scanReceipt, type ReceiptData } from "@/lib/receipts";
import { addExpense, type Account } from "@/lib/expenses";
import { recordPrice } from "@/lib/products";
import type { Category } from "@/lib/categories";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];
const eur = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;
type Step = "choose" | "scanning" | "review";
type Source = "camera" | "library" | "pdf";

export function ScanModal({
  visible,
  hogarId,
  userName,
  categories,
  initialSource,
  onClose,
  onDone,
}: {
  visible: boolean;
  hogarId: string;
  userName: string;
  categories: Category[];
  /** Si se indica, al abrir arranca directamente ese origen (cámara/galería/pdf). */
  initialSource?: Source | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTheme();
  const [step, setStep] = useState<Step>("choose");
  const [data, setData] = useState<ReceiptData | null>(null);
  const [merchant, setMerchant] = useState("");
  const [total, setTotal] = useState("");
  const [account, setAccount] = useState<Account>("individual");
  const [category, setCategory] = useState<string | null>(null);
  const [savePrices, setSavePrices] = useState(true);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setStep("choose");
    setData(null);
    setMerchant("");
    setTotal("");
    setAccount("individual");
    setCategory(null);
    setSavePrices(true);
    setPicked(new Set());
  };
  const close = () => {
    reset();
    onClose();
  };

  const run = async (source: Source) => {
    try {
      let base64 = "";
      let mime = "image/jpeg";

      if (source === "pdf") {
        const res = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true });
        if (res.canceled) return;
        setStep("scanning");
        base64 = await new File(res.assets[0].uri).base64();
        mime = "application/pdf";
      } else {
        const perm =
          source === "camera"
            ? await ImagePicker.requestCameraPermissionsAsync()
            : await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert("Permiso necesario", "Activa el permiso de cámara/fotos en los ajustes para escanear tickets.");
          return;
        }
        const res =
          source === "camera"
            ? await ImagePicker.launchCameraAsync({ quality: 1 })
            : await ImagePicker.launchImageLibraryAsync({ quality: 1, mediaTypes: ["images"] });
        if (res.canceled) return;
        setStep("scanning");
        const shrunk = await ImageManipulator.manipulateAsync(
          res.assets[0].uri,
          [{ resize: { width: 1400 } }],
          { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true },
        );
        base64 = shrunk.base64 ?? "";
      }

      const receipt = await scanReceipt(base64, mime);
      setData(receipt);
      setMerchant(receipt.merchant ?? "");
      setTotal(receipt.total != null ? String(receipt.total).replace(".", ",") : "");
      const pre = new Set<number>();
      receipt.lines.forEach((l, i) => {
        if ((l.total != null || l.unitPrice != null) && l.description.trim()) pre.add(i);
      });
      setPicked(pre);
      setStep("review");
    } catch (e) {
      setStep("choose");
      Alert.alert("No se pudo leer el ticket", e instanceof Error ? e.message : "Inténtalo de nuevo.");
    }
  };

  // Auto-arranca el origen elegido en la tarjeta "Subir ticket" al abrir el modal.
  const startedRef = useRef(false);
  useEffect(() => {
    if (visible && initialSource && !startedRef.current) {
      startedRef.current = true;
      run(initialSource);
    }
    if (!visible) startedRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialSource]);

  const toggleLine = (i: number) => {
    hSelect();
    const next = new Set(picked);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setPicked(next);
  };

  const save = async () => {
    const value = parseFloat(total.replace(",", "."));
    if (!isFinite(value) || value <= 0) {
      Alert.alert("Falta el total", "Escribe un total válido para el gasto.");
      return;
    }
    setBusy(true);
    try {
      await addExpense(hogarId, {
        amount: value,
        concept: merchant.trim() || "Compra",
        paidByName: userName,
        account,
        shared: account === "joint",
        category: category ?? undefined,
        spentAt: data?.date ? new Date(data.date).toISOString() : undefined,
      });
      // Los precios son "best-effort": el gasto ya está guardado, así que si falla
      // registrar un precio NO abortamos (evita que reintentar duplique el gasto).
      let saved = 0;
      let failed = 0;
      if (savePrices && data) {
        const store = merchant.trim() || "Súper";
        for (const i of picked) {
          const l = data.lines[i];
          // Para la base de precios interesa el precio por UNIDAD, no el importe de la
          // línea (p. ej. "2 × 4,49 = 8,98" → guardamos 4,49).
          const unit = l?.unitPrice ?? l?.total;
          if (l && unit != null && l.description.trim()) {
            try {
              await recordPrice(hogarId, l.description.trim(), unit, store);
              saved++;
            } catch {
              failed++;
            }
          }
        }
      }
      onDone();
      const priceMsg = saved ? ` y ${saved} precios registrados` : "";
      const failMsg = failed ? ` (${failed} precios no se pudieron guardar)` : "";
      Alert.alert("Guardado", `Gasto añadido${priceMsg}.${failMsg}`);
      close();
    } catch (e) {
      Alert.alert("No se pudo guardar", e instanceof Error ? e.message : "Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  const nLines = data?.lines.length ?? 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable className="flex-1" style={{ backgroundColor: t.overlay }} onPress={close} />
      <View className="rounded-t-[14px] absolute left-0 right-0 bottom-0" style={{ height: step === "review" ? "90%" : undefined, backgroundColor: t.bg }}>
        <View className="flex-row items-center justify-between px-5 py-3" style={{ borderBottomWidth: 0.5, borderBottomColor: t.separator }}>
          <Pressable onPress={close} hitSlop={8}><Text className="text-base text-accent">Cerrar</Text></Pressable>
          <Text className="text-[17px] font-semibold text-label">{step === "review" ? "Ticket detectado" : "Escanear ticket"}</Text>
          <View style={{ width: 52 }} />
        </View>

        {/* --- Elegir origen (tarjeta con degradado, como el mockup) --- */}
        {step === "choose" && (
          <View className="px-4 pt-5 pb-8">
            <LinearGradient
              colors={[t.accent, "#2A6E75"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ borderRadius: 18, padding: 16, shadowColor: t.accent, shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } }}
            >
              <View className="flex-row items-center mb-3" style={{ gap: 10 }}>
                <View className="rounded-[10px] items-center justify-center" style={{ width: 32, height: 32, backgroundColor: "rgba(255,255,255,0.18)" }}>
                  <Ionicons name="receipt-outline" size={18} color="#fff" />
                </View>
                <View className="flex-1">
                  <Text className="text-white text-[15px] font-semibold">Subir ticket</Text>
                  <Text className="text-[12px]" style={{ color: "rgba(255,255,255,0.85)" }}>OCR automático · gasto + precios</Text>
                </View>
              </View>
              <View className="flex-row" style={{ gap: 6 }}>
                {([
                  { key: "camera", label: "Cámara", icon: "camera-outline" },
                  { key: "library", label: "Galería", icon: "images-outline" },
                  { key: "pdf", label: "PDF", icon: "document-text-outline" },
                ] as const).map((o) => (
                  <Pressable
                    key={o.key}
                    onPress={() => run(o.key)}
                    className="flex-1 items-center justify-center rounded-[12px] py-3"
                    style={{ backgroundColor: "rgba(255,255,255,0.16)", gap: 5 }}
                  >
                    <Ionicons name={o.icon as IoniconName} size={20} color="#fff" />
                    <Text className="text-white text-[13px] font-semibold">{o.label}</Text>
                  </Pressable>
                ))}
              </View>
            </LinearGradient>
            <Text className="text-[13px] text-secondary text-center mt-5 px-4">
              Foto recta y bien iluminada, o un PDF del ticket. Detecto comercio, total y productos; luego lo revisas.
            </Text>
          </View>
        )}

        {step === "scanning" && (
          <View className="px-6 py-16 items-center">
            <ActivityIndicator color={t.accent} size="large" />
            <Text className="text-secondary mt-4">Leyendo el ticket…</Text>
          </View>
        )}

        {/* --- Revisión (estilo "ticket detectado" del mockup) --- */}
        {step === "review" && data && (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
            <View className="bg-card rounded-card p-4 mb-3" style={{ shadowColor: "#000", shadowOpacity: t.dark ? 0 : 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }}>
              <View className="flex-row items-center mb-3" style={{ gap: 8 }}>
                <Ionicons name="checkmark-circle" size={18} color={t.green} />
                <Text className="text-[13px] font-medium" style={{ color: t.green }}>
                  Ticket leído · {nLines} {nLines === 1 ? "producto" : "productos"}
                </Text>
              </View>

              <MetaRow label="Comercio">
                <TextInput
                  className="text-[15px] text-label text-right"
                  style={{ minWidth: 120, flex: 1, marginLeft: 12 }}
                  value={merchant}
                  onChangeText={setMerchant}
                  placeholder="Súper"
                  placeholderTextColor={t.labelTertiary}
                />
              </MetaRow>
              <MetaRow label="Fecha">
                <Text className="text-[15px] text-label font-medium">{data.date ?? "Hoy"}</Text>
              </MetaRow>
              <MetaRow label="Total">
                <View className="flex-row items-center" style={{ gap: 4 }}>
                  <TextInput
                    className="text-[17px] font-bold text-label text-right"
                    style={{ minWidth: 70 }}
                    value={total}
                    onChangeText={setTotal}
                    keyboardType="decimal-pad"
                    placeholder="0,00"
                    placeholderTextColor={t.labelTertiary}
                  />
                  <Text className="text-[15px] text-secondary">€</Text>
                </View>
              </MetaRow>
              <MetaRow label="Cuenta" last>
                <View className="flex-row" style={{ gap: 6 }}>
                  {([
                    { key: "individual", label: "Individual" },
                    { key: "joint", label: "Conjunta" },
                  ] as const).map((o) => {
                    const on = account === o.key;
                    return (
                      <Pressable key={o.key} onPress={() => setAccount(o.key)} className="rounded-pill px-3 py-1.5" style={{ backgroundColor: on ? t.accent : t.fill }}>
                        <Text className="text-[13px] font-medium" style={{ color: on ? "#fff" : t.label }}>{o.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </MetaRow>
            </View>

            {categories.length > 0 && (
              <>
                <Text className="px-1 pb-2 text-[12px] font-medium uppercase tracking-wide text-secondary">Categoría</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3" contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
                  {categories.map((c) => {
                    const on = category === c.name;
                    return (
                      <Pressable key={c.$id} onPress={() => setCategory(on ? null : c.name)} className="flex-row items-center rounded-pill px-3 py-2" style={{ gap: 6, backgroundColor: on ? c.color : t.fill }}>
                        <Ionicons name={c.icon as IoniconName} size={14} color={on ? "#fff" : c.color} />
                        <Text className="text-[13px] font-medium" style={{ color: on ? "#fff" : t.label }}>{c.name}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </>
            )}

            {nLines > 0 && (
              <>
                <View className="flex-row items-center justify-between px-1 mb-2">
                  <Text className="text-[12px] font-medium uppercase tracking-wide text-secondary">Productos detectados</Text>
                  <View className="flex-row items-center" style={{ gap: 8 }}>
                    <Text className="text-[12px] text-secondary">Guardar precios</Text>
                    <Switch value={savePrices} onValueChange={setSavePrices} trackColor={{ true: t.accent, false: t.separator }} />
                  </View>
                </View>
                {savePrices && (
                  <View className="bg-card rounded-lg2 overflow-hidden mb-2">
                    {data.lines.map((l, i) => {
                      const on = picked.has(i);
                      const usable = (l.total != null || l.unitPrice != null) && !!l.description.trim();
                      return (
                        <Pressable
                          key={i}
                          disabled={!usable}
                          onPress={() => toggleLine(i)}
                          className="flex-row items-center px-4 py-3"
                          style={{ gap: 12, borderTopWidth: i ? 0.5 : 0, borderTopColor: t.separator, opacity: usable ? 1 : 0.4 }}
                        >
                          <View className="items-center justify-center rounded-full" style={{ width: 22, height: 22, backgroundColor: on ? t.accent : "transparent", borderWidth: on ? 0 : 1.6, borderColor: t.separator }}>
                            {on && <Ionicons name="checkmark" size={13} color="#fff" />}
                          </View>
                          <View className="flex-1">
                            <Text className="text-[14px] text-label" numberOfLines={1}>{l.description.trim() || "—"}</Text>
                            {l.qty != null && l.qty > 1 && l.unitPrice != null && (
                              <Text className="text-[12px] text-secondary">{l.qty} × {eur(l.unitPrice)}</Text>
                            )}
                          </View>
                          <Text className="text-[14px] font-semibold text-label" style={{ fontVariant: ["tabular-nums"] }}>
                            {l.total != null ? eur(l.total) : l.unitPrice != null ? eur(l.unitPrice) : "—"}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </>
            )}

            <Pressable onPress={save} disabled={busy} className="rounded-[14px] py-3.5 items-center mt-3" style={{ backgroundColor: t.accent, opacity: busy ? 0.6 : 1 }}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text className="text-white text-base font-semibold">Guardar gasto{savePrices && picked.size ? ` + ${picked.size} precios` : ""}</Text>}
            </Pressable>
            <Text className="text-center text-[12px] text-tertiary mt-3">Puedes editar el comercio y el total antes de guardar.</Text>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

function MetaRow({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  const t = useTheme();
  return (
    <View
      className="flex-row items-center justify-between"
      style={{ paddingVertical: 9, borderBottomWidth: last ? 0 : 0.5, borderBottomColor: t.separator }}
    >
      <Text className="text-[13px] text-secondary">{label}</Text>
      {children}
    </View>
  );
}
