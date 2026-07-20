import { useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { useTheme } from "@/theme/theme";
import { scanReceipt, type ReceiptData } from "@/lib/receipts";
import { addExpense, type Account } from "@/lib/expenses";
import { recordPrice } from "@/lib/products";
import type { Category } from "@/lib/categories";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];
const eur = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;
type Step = "choose" | "scanning" | "review";

export function ScanModal({
  visible,
  hogarId,
  userName,
  categories,
  onClose,
  onDone,
}: {
  visible: boolean;
  hogarId: string;
  userName: string;
  categories: Category[];
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

  const run = async (source: "camera" | "library") => {
    try {
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
      const receipt = await scanReceipt(shrunk.base64 ?? "");
      setData(receipt);
      setMerchant(receipt.merchant ?? "");
      setTotal(receipt.total != null ? String(receipt.total).replace(".", ",") : "");
      const pre = new Set<number>();
      receipt.lines.forEach((l, i) => {
        if (l.total != null && l.description.trim()) pre.add(i);
      });
      setPicked(pre);
      setStep("review");
    } catch (e) {
      setStep("choose");
      Alert.alert("No se pudo leer el ticket", e instanceof Error ? e.message : "Inténtalo de nuevo.");
    }
  };

  const toggleLine = (i: number) => {
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
      if (savePrices && data) {
        const store = merchant.trim() || "Súper";
        for (const i of picked) {
          const l = data.lines[i];
          if (l && l.total != null && l.description.trim()) {
            await recordPrice(hogarId, l.description.trim(), l.total, store);
          }
        }
      }
      onDone();
      Alert.alert("Guardado", "Gasto añadido" + (savePrices && picked.size ? ` y ${picked.size} precios registrados.` : "."));
      close();
    } catch (e) {
      Alert.alert("No se pudo guardar", e instanceof Error ? e.message : "Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable className="flex-1" style={{ backgroundColor: t.overlay }} onPress={close} />
      <View className="rounded-t-[14px] absolute left-0 right-0 bottom-0" style={{ height: step === "review" ? "88%" : undefined, backgroundColor: t.bg }}>
        <View className="flex-row items-center justify-between px-5 py-3" style={{ borderBottomWidth: 0.5, borderBottomColor: t.separator }}>
          <Pressable onPress={close} hitSlop={8}><Text className="text-base text-accent">Cerrar</Text></Pressable>
          <Text className="text-[17px] font-semibold text-label">Escanear ticket</Text>
          <View style={{ width: 52 }} />
        </View>

        {step === "choose" && (
          <View className="px-6 pt-7 pb-8 items-center">
            <View className="rounded-full items-center justify-center mb-4" style={{ width: 64, height: 64, backgroundColor: t.accentSoft }}>
              <Ionicons name="receipt-outline" size={30} color={t.accent} />
            </View>
            <Text className="text-[14px] text-secondary text-center mb-6">
              Haz una foto al ticket (recto y bien iluminado) y crearé el gasto con el total; si quieres, guardo también los productos en la base de precios.
            </Text>
            <Pressable onPress={() => run("camera")} className="rounded-[14px] py-3.5 items-center flex-row justify-center w-full mb-3" style={{ backgroundColor: t.accent, gap: 8 }}>
              <Ionicons name="camera" size={18} color="#fff" />
              <Text className="text-white text-base font-semibold">Hacer foto</Text>
            </Pressable>
            <Pressable onPress={() => run("library")} className="rounded-[14px] py-3.5 items-center flex-row justify-center w-full" style={{ gap: 8, borderWidth: 1, borderColor: t.separator }}>
              <Ionicons name="images-outline" size={18} color={t.accent} />
              <Text className="text-[15px] font-semibold text-accent">Elegir de la galería</Text>
            </Pressable>
          </View>
        )}

        {step === "scanning" && (
          <View className="px-6 py-16 items-center">
            <ActivityIndicator color={t.accent} size="large" />
            <Text className="text-secondary mt-4">Leyendo el ticket…</Text>
          </View>
        )}

        {step === "review" && data && (
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }}>
            <Text className="text-[12px] font-medium uppercase tracking-wide text-secondary mb-2">Comercio</Text>
            <TextInput
              className="bg-card rounded-lg2 px-4 py-3 mb-3 text-[16px] text-label"
              placeholder="Súper"
              placeholderTextColor={t.labelTertiary}
              value={merchant}
              onChangeText={setMerchant}
            />
            <View className="flex-row mb-3" style={{ gap: 8 }}>
              <View className="flex-1">
                <Text className="text-[12px] font-medium uppercase tracking-wide text-secondary mb-2">Total</Text>
                <TextInput
                  className="bg-card rounded-lg2 px-4 py-3 text-[16px] text-label"
                  placeholder="0,00"
                  placeholderTextColor={t.labelTertiary}
                  value={total}
                  onChangeText={setTotal}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={{ width: 130 }}>
                <Text className="text-[12px] font-medium uppercase tracking-wide text-secondary mb-2">Fecha</Text>
                <View className="bg-card rounded-lg2 px-4 py-3">
                  <Text className="text-[15px] text-label">{data.date ?? "Hoy"}</Text>
                </View>
              </View>
            </View>

            <Text className="text-[12px] font-medium uppercase tracking-wide text-secondary mb-2">Cuenta</Text>
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

            {categories.length > 0 && (
              <>
                <Text className="text-[12px] font-medium uppercase tracking-wide text-secondary mb-2">Categoría</Text>
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

            {data.lines.length > 0 && (
              <>
                <View className="flex-row items-center justify-between mt-1 mb-2">
                  <Text className="text-[12px] font-medium uppercase tracking-wide text-secondary">Productos ({data.lines.length})</Text>
                  <View className="flex-row items-center" style={{ gap: 8 }}>
                    <Text className="text-[12px] text-secondary">Guardar precios</Text>
                    <Switch value={savePrices} onValueChange={setSavePrices} trackColor={{ true: t.accent, false: t.separator }} />
                  </View>
                </View>
                {savePrices && (
                  <View className="bg-card rounded-lg2 overflow-hidden">
                    {data.lines.map((l, i) => {
                      const on = picked.has(i);
                      const usable = l.total != null && !!l.description.trim();
                      return (
                        <Pressable
                          key={i}
                          disabled={!usable}
                          onPress={() => toggleLine(i)}
                          className="flex-row items-center px-4 py-2.5"
                          style={{ gap: 10, borderTopWidth: i ? 0.5 : 0, borderTopColor: t.separator, opacity: usable ? 1 : 0.4 }}
                        >
                          <View className="items-center justify-center rounded-md" style={{ width: 20, height: 20, borderWidth: 1.6, borderColor: on ? t.accent : t.separator, backgroundColor: on ? t.accent : "transparent" }}>
                            {on && <Ionicons name="checkmark" size={12} color="#fff" />}
                          </View>
                          <Text className="flex-1 text-[14px] text-label" numberOfLines={1}>{l.description.trim() || "—"}</Text>
                          <Text className="text-[14px] font-semibold text-label" style={{ fontVariant: ["tabular-nums"] }}>
                            {l.total != null ? eur(l.total) : "—"}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </>
            )}

            <Pressable onPress={save} disabled={busy} className="rounded-[14px] py-3.5 items-center mt-5" style={{ backgroundColor: t.accent, opacity: busy ? 0.6 : 1 }}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text className="text-white text-base font-semibold">Guardar gasto{savePrices && picked.size ? ` + ${picked.size} precios` : ""}</Text>}
            </Pressable>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}
