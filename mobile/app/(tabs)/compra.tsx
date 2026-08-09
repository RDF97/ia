import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Screen } from "@/components/Screen";
import { PhaseCard } from "@/components/Card";
import { ProductsModal } from "@/components/compra/ProductsModal";
import { ScanModal } from "@/components/gastos/ScanModal";
import { AddBar } from "@/components/AddBar";
import { UploadCard } from "@/components/UploadCard";
import { SwipeToDelete } from "@/components/SwipeToDelete";
import { useHogar } from "@/lib/hogar";
import { useAuth } from "@/lib/auth";
import { appwriteConfigured } from "@/lib/appwrite";
import { useShopping } from "@/lib/useShopping";
import { useCategories } from "@/lib/useCategories";
import { addItem, deleteItem, setItemDone, type ShoppingItem } from "@/lib/shopping";
import { listProducts, normalizeName, recordPrice, type Product } from "@/lib/products";
import { startDictation, voiceErrorMessage, type VoiceSession } from "@/lib/voice";
import { useTheme } from "@/theme/theme";
import { useKeyboardHeight } from "@/lib/useKeyboard";

type ScanSource = "camera" | "library" | "pdf";
const eur = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;

export default function Compra() {
  const { active } = useHogar();
  const { user } = useAuth();

  if (!appwriteConfigured || !active) {
    return (
      <Screen title="Compra" subtitle="Lista colaborativa">
        <PhaseCard phase="Fase 3 · Compra">
          Lista de la compra compartida en tiempo real, con base de precios por producto y
          supermercado. Se activa al configurar el backend y entrar en un hogar.
        </PhaseCard>
      </Screen>
    );
  }
  return <CompraList hogarId={active.$id} userName={user?.name || "Yo"} />;
}

const oops = (e: unknown) =>
  Alert.alert("No se pudo completar", e instanceof Error ? e.message : "Revisa tu conexión e inténtalo de nuevo.");

/** Una tienda con sus productos (pendientes primero, comprados al final). */
interface StoreGroup {
  store: string;
  items: ShoppingItem[];
}

/**
 * Clave interna del grupo de los productos que aún no tienen supermercado.
 * Ese grupo va SIN cabecera: poner "Otros" encima de cada cosa que acabas de
 * añadir es ruido, porque es lo normal hasta que se escanea un ticket.
 */
const NO_STORE = "";

function groupByStore(items: ShoppingItem[]): StoreGroup[] {
  const map = new Map<string, ShoppingItem[]>();
  for (const it of items) {
    const key = (it.store && it.store.trim()) || NO_STORE;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(it);
  }
  const groups = [...map.entries()].map(([store, list]) => ({
    store,
    items: list.sort((a, b) => Number(a.done) - Number(b.done)),
  }));
  // Los que no tienen tienda van primero (son los recién añadidos).
  return groups.sort((a, b) => {
    if (a.store === NO_STORE) return -1;
    if (b.store === NO_STORE) return 1;
    return a.store.localeCompare(b.store);
  });
}

function CompraList({ hogarId, userName }: { hogarId: string; userName: string }) {
  const t = useTheme();
  const qc = useQueryClient();
  const { data: items, isLoading, isError } = useShopping(hogarId);
  const { data: cats } = useCategories(hogarId);
  const products = useQuery({
    queryKey: ["products", hogarId],
    queryFn: () => listProducts(hogarId),
    enabled: !!hogarId,
  });

  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [pricePrompt, setPricePrompt] = useState<ShoppingItem | null>(null);
  const [dbOpen, setDbOpen] = useState(false);
  const [scanSource, setScanSource] = useState<ScanSource | null>(null);
  const inputRef = useRef<TextInput>(null);
  const [listening, setListening] = useState(false);
  const voiceRef = useRef<VoiceSession | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["shopping", hogarId] });

  // Índice producto por nombre normalizado → último precio/tienda conocidos.
  const priceIndex = new Map<string, Product>();
  for (const p of products.data ?? []) priceIndex.set(normalizeName(p.name).toLowerCase(), p);

  // Dictado por voz. El reconocimiento nativo solo existe en la APK (no en Expo
  // Go); si no está, caemos en el dictado del teclado del móvil.
  const dictate = async () => {
    if (listening) {
      voiceRef.current?.stop();
      return;
    }
    setListening(true);
    const session = await startDictation({
      onResult: (text) => setName(text),
      onEnd: (err, detail) => {
        setListening(false);
        voiceRef.current = null;
        if (!err) return;
        // Sin módulo nativo (Expo Go) al menos abrimos el teclado, que trae micro.
        if (err === "no-module") inputRef.current?.focus();
        Alert.alert("Dictado por voz", voiceErrorMessage(err, detail));
      },
    });
    voiceRef.current = session;
    if (!session) setListening(false);
  };

  const add = async () => {
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    setName("");
    try {
      await addItem(hogarId, n, userName);
      refresh();
    } catch (e) {
      oops(e);
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (item: ShoppingItem) => {
    if (!item.done) {
      // Al comprar, ofrecemos apuntar el precio (alimenta la BD de precios).
      setPricePrompt(item);
      return;
    }
    try {
      await setItemDone(item, false);
      refresh();
    } catch (e) {
      oops(e);
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteItem(id);
      refresh();
    } catch (e) {
      oops(e);
    }
  };

  const all = items ?? [];
  const pending = all.filter((i) => !i.done);
  const groups = groupByStore(all);

  return (
    <Screen
      title="Compra"
      subtitle={`${all.length} ${all.length === 1 ? "producto" : "productos"} · sincronizado`}
      onRefresh={refresh}
      contentBottom={150}
      right={
        <Pressable
          onPress={() => setDbOpen(true)}
          className="rounded-pill items-center justify-center"
          style={{ width: 44, height: 44, backgroundColor: t.fill, marginBottom: 4 }}
        >
          <Ionicons name="server-outline" size={17} color={t.accent} />
        </Pressable>
      }
      floating={
        <AddBar
          placeholder="Añadir a la lista…"
          value={name}
          onChange={setName}
          onSubmit={add}
          busy={busy}
          actionIcon={listening ? "stop" : "mic"}
          onAction={dictate}
          inputRef={inputRef}
        />
      }
    >
      {/* Subir ticket (OCR) — mismo flujo que el escáner de Gastos */}
      <UploadCard
        title="Subir ticket"
        subtitle="OCR automático · vincula precios y supermercado"
        actions={[
          { key: "camera", label: "Cámara", icon: "camera-outline", onPress: () => setScanSource("camera") },
          { key: "library", label: "Galería", icon: "images-outline", onPress: () => setScanSource("library") },
          { key: "pdf", label: "PDF", icon: "document-text-outline", onPress: () => setScanSource("pdf") },
        ]}
      />

      {isError && (
        <Text className="text-center text-footnote mb-2" style={{ color: t.red }}>
          No se pudo cargar la lista. Desliza hacia abajo para reintentar.
        </Text>
      )}

      {isLoading ? (
        <ActivityIndicator color={t.accent} style={{ marginTop: 24 }} />
      ) : all.length === 0 ? (
        <Text className="text-center text-tertiary mt-8">Lista vacía. ¡Añade el primer producto!</Text>
      ) : (
        groups.map((g) => (
          <ShopSection
            key={g.store || "sin-tienda"}
            group={g}
            priceIndex={priceIndex}
            onToggle={toggle}
            onDelete={remove}
          />
        ))
      )}

      <PricePrompt
        item={pricePrompt}
        hogarId={hogarId}
        onDone={() => {
          setPricePrompt(null);
          refresh();
          products.refetch();
        }}
        onCancel={() => setPricePrompt(null)}
      />
      <ProductsModal visible={dbOpen} hogarId={hogarId} onClose={() => setDbOpen(false)} />
      <ScanModal
        visible={scanSource !== null}
        hogarId={hogarId}
        userName={userName}
        categories={cats ?? []}
        initialSource={scanSource}
        onClose={() => setScanSource(null)}
        onDone={() => {
          setScanSource(null);
          refresh();
          products.refetch();
        }}
      />
    </Screen>
  );
}

/** Sección por tienda: cabecera (nombre · recuento) + filas de producto. */
function ShopSection({
  group,
  priceIndex,
  onToggle,
  onDelete,
}: {
  group: StoreGroup;
  priceIndex: Map<string, Product>;
  onToggle: (i: ShoppingItem) => void;
  onDelete: (id: string) => void;
}) {
  const t = useTheme();
  const pending = group.items.filter((i) => !i.done).length;
  return (
    <View className="mx-4 mb-4">
      {group.store ? (
        <View className="flex-row items-center justify-between px-1 pb-2">
          <Text className="text-subhead font-semibold text-label" style={{ letterSpacing: -0.2 }}>{group.store}</Text>
          <Text className="text-caption1 text-secondary">
            {pending > 0 ? `${pending} por comprar` : `${group.items.length} ${group.items.length === 1 ? "producto" : "productos"}`}
          </Text>
        </View>
      ) : null}
      <View className="bg-card rounded-lg2 overflow-hidden" style={{ shadowColor: "#000", shadowOpacity: t.dark ? 0 : 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }}>
        {group.items.map((item, i) => (
          <ShopRow
            key={item.$id}
            item={item}
            product={priceIndex.get(normalizeName(item.name).toLowerCase())}
            first={i === 0}
            onToggle={() => onToggle(item)}
            onDelete={() => onDelete(item.$id)}
          />
        ))}
      </View>
    </View>
  );
}

/** Fila de producto: check · nombre + meta (última X€ · tienda) · ×cantidad. */
function ShopRow({
  item,
  product,
  first,
  onToggle,
  onDelete,
}: {
  item: ShoppingItem;
  product?: Product;
  first: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const t = useTheme();

  let meta: string;
  if (item.done) {
    meta = "Comprado";
  } else if (product?.lastPrice != null) {
    meta = `última ${eur(product.lastPrice)}` + (product.lastStore ? ` · ${product.lastStore}` : "");
  } else {
    meta = `Añadió ${item.createdByName}`;
  }

  const qtyNum = item.qty ? parseInt(item.qty, 10) : NaN;
  const qtyLabel = item.done ? "✓" : Number.isFinite(qtyNum) ? `×${qtyNum}` : item.qty ? item.qty : "×1";

  return (
    <SwipeToDelete onDelete={onDelete}>
    <View
      className="flex-row items-center px-4 py-3"
      style={{ gap: 12, borderTopWidth: first ? 0 : 0.5, borderTopColor: t.separator }}
    >
      <Pressable
        onPress={onToggle}
        hitSlop={8}
        className="items-center justify-center rounded-full"
        style={{ width: 22, height: 22, backgroundColor: item.done ? t.accent : "transparent", borderWidth: item.done ? 0 : 1.7, borderColor: t.labelTertiary }}
      >
        {item.done && <Ionicons name="checkmark" size={13} color="#fff" />}
      </Pressable>
      <Pressable className="flex-1" onPress={onToggle} onLongPress={onDelete}>
        <Text
          className="text-body"
          numberOfLines={1}
          style={{ color: item.done ? t.labelTertiary : t.label, textDecorationLine: item.done ? "line-through" : "none" }}
        >
          {item.name}
        </Text>
        <Text className="text-caption1 text-secondary mt-0.5" numberOfLines={1}>{meta}</Text>
      </Pressable>
      <Text className="text-footnote text-secondary" style={{ fontVariant: ["tabular-nums"] }}>{qtyLabel}</Text>
    </View>
    </SwipeToDelete>
  );
}

function PricePrompt({
  item,
  hogarId,
  onDone,
  onCancel,
}: {
  item: ShoppingItem | null;
  hogarId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useTheme();
  const kb = useKeyboardHeight();
  const [price, setPrice] = useState("");
  const [store, setStore] = useState("");
  const [busy, setBusy] = useState(false);

  const finish = async (savePrice: boolean) => {
    if (!item) return;
    setBusy(true);
    try {
      if (savePrice) {
        const value = parseFloat(price.replace(",", "."));
        if (!isFinite(value) || value <= 0 || !store.trim()) {
          Alert.alert("Faltan datos", "Pon un precio válido y el supermercado, o pulsa Omitir.");
          setBusy(false);
          return;
        }
        await recordPrice(hogarId, item.name, value, store.trim());
      }
      await setItemDone(item, true);
      setPrice("");
      setStore("");
      onDone();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={item !== null} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable className="flex-1" style={{ backgroundColor: t.overlay }} onPress={onCancel} />
      <View className="rounded-t-[14px] absolute left-0 right-0 bottom-0 p-5" style={{ paddingBottom: 32 + kb, backgroundColor: t.bg }}>
        <Text className="text-headline font-semibold mb-1 text-label">¿A cuánto lo has comprado?</Text>
        <Text className="text-footnote text-secondary mb-4">
          {item?.name} · alimenta la base de precios para comparar supermercados.
        </Text>
        <View className="flex-row mb-3" style={{ gap: 8 }}>
          <TextInput
            className="bg-card rounded-lg2 px-4 py-3 text-callout text-label"
            style={{ width: 110 }}
            placeholder="Precio €"
            placeholderTextColor={t.labelTertiary}
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
          />
          <TextInput
            className="flex-1 bg-card rounded-lg2 px-4 py-3 text-callout text-label"
            placeholder="Supermercado (Mercadona, Día…)"
            placeholderTextColor={t.labelTertiary}
            value={store}
            onChangeText={setStore}
          />
        </View>
        <Pressable
          onPress={() => finish(true)}
          disabled={busy}
          className="rounded-[14px] py-3.5 items-center"
          style={{ backgroundColor: t.accent, opacity: busy ? 0.6 : 1 }}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text className="text-white text-base font-semibold">Guardar precio</Text>}
        </Pressable>
        <Pressable onPress={() => finish(false)} disabled={busy} className="mt-3 items-center py-1">
          <Text className="text-subhead" style={{ color: t.accent }}>Omitir · solo marcar comprado</Text>
        </Pressable>
      </View>
    </Modal>
  );
}
