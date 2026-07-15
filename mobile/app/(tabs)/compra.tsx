import { useState } from "react";
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
import { useQueryClient } from "@tanstack/react-query";
import { Screen } from "@/components/Screen";
import { PhaseCard, cardShadow } from "@/components/Card";
import { CheckCircle } from "@/components/ui";
import { ProductsModal } from "@/components/compra/ProductsModal";
import { useHogar } from "@/lib/hogar";
import { useAuth } from "@/lib/auth";
import { appwriteConfigured } from "@/lib/appwrite";
import { useShopping } from "@/lib/useShopping";
import { addItem, deleteItem, setItemDone, type ShoppingItem } from "@/lib/shopping";
import { recordPrice } from "@/lib/products";
import { useTheme } from "@/theme/theme";

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

function CompraList({ hogarId, userName }: { hogarId: string; userName: string }) {
  const t = useTheme();
  const qc = useQueryClient();
  const { data: items, isLoading, isError } = useShopping(hogarId);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [pricePrompt, setPricePrompt] = useState<ShoppingItem | null>(null);
  const [dbOpen, setDbOpen] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ["shopping", hogarId] });

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

  const pending = (items ?? []).filter((i) => !i.done);
  const bought = (items ?? []).filter((i) => i.done);

  return (
    <Screen
      title="Compra"
      subtitle={`${pending.length} por comprar`}
      onRefresh={refresh}
      right={
        <Pressable
          onPress={() => setDbOpen(true)}
          className="rounded-pill items-center justify-center"
          style={{ width: 36, height: 36, backgroundColor: t.fill, marginBottom: 4 }}
        >
          <Ionicons name="pricetags-outline" size={17} color={t.accent} />
        </Pressable>
      }
    >
      <View
        className="flex-row items-center bg-card rounded-pill mx-4 mb-4 px-4 py-2"
        style={{ gap: 8, borderWidth: 0.5, borderColor: t.separator }}
      >
        <Ionicons name="add" size={22} color={t.accent} />
        <TextInput
          className="flex-1 text-[16px] text-label"
          placeholder="Añadir a la lista…"
          placeholderTextColor={t.labelTertiary}
          value={name}
          onChangeText={setName}
          onSubmitEditing={add}
          returnKeyType="done"
        />
        {busy && <ActivityIndicator color={t.accent} />}
      </View>

      {isError && (
        <Text className="text-center text-[13px] mb-2" style={{ color: t.red }}>
          No se pudo cargar la lista. Desliza hacia abajo para reintentar.
        </Text>
      )}
      {isLoading ? (
        <ActivityIndicator color={t.accent} style={{ marginTop: 24 }} />
      ) : (
        <>
          <Section title="Por comprar" items={pending} onToggle={toggle} onDelete={remove} />
          {bought.length > 0 && (
            <Section title="Comprado" items={bought} onToggle={toggle} onDelete={remove} />
          )}
          {pending.length === 0 && bought.length === 0 && (
            <Text className="text-center text-tertiary mt-8">
              Lista vacía. ¡Añade el primer producto!
            </Text>
          )}
        </>
      )}

      <PricePrompt
        item={pricePrompt}
        hogarId={hogarId}
        onDone={() => {
          setPricePrompt(null);
          refresh();
        }}
        onCancel={() => setPricePrompt(null)}
      />
      <ProductsModal visible={dbOpen} hogarId={hogarId} onClose={() => setDbOpen(false)} />
    </Screen>
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
      <View className="rounded-t-[14px] absolute left-0 right-0 bottom-0 p-5" style={{ paddingBottom: 32, backgroundColor: t.bg }}>
        <Text className="text-[17px] font-semibold mb-1 text-label">¿A cuánto lo has comprado?</Text>
        <Text className="text-[13px] text-secondary mb-4">
          {item?.name} · alimenta la base de precios para comparar supermercados.
        </Text>
        <View className="flex-row mb-3" style={{ gap: 8 }}>
          <TextInput
            className="bg-card rounded-lg2 px-4 py-3 text-[16px] text-label"
            style={{ width: 110 }}
            placeholder="Precio €"
            placeholderTextColor={t.labelTertiary}
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
          />
          <TextInput
            className="flex-1 bg-card rounded-lg2 px-4 py-3 text-[16px] text-label"
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
          <Text className="text-[14px]" style={{ color: t.accent }}>Omitir · solo marcar comprado</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function Section({
  title,
  items,
  onToggle,
  onDelete,
}: {
  title: string;
  items: ShoppingItem[];
  onToggle: (i: ShoppingItem) => void;
  onDelete: (id: string) => void;
}) {
  const t = useTheme();
  if (items.length === 0) return null;
  return (
    <>
      <Text className="px-5 pt-2 pb-2 text-[13px] font-medium uppercase tracking-wide text-secondary">
        {title}
      </Text>
      <View className="bg-card rounded-lg2 mx-4 mb-3 overflow-hidden" style={cardShadow(t.dark)}>
        {items.map((item, i) => (
          <View
            key={item.$id}
            className="flex-row items-center px-4 py-3"
            style={{ gap: 12, borderTopWidth: i ? 0.5 : 0, borderTopColor: t.separator }}
          >
            <CheckCircle done={item.done} onPress={() => onToggle(item)} />
            <View className="flex-1">
              <Text
                className="text-[15px]"
                style={{
                  color: item.done ? t.labelTertiary : t.label,
                  textDecorationLine: item.done ? "line-through" : "none",
                }}
              >
                {item.name}
                {item.qty ? <Text className="text-secondary">  {item.qty}</Text> : null}
              </Text>
              <Text className="text-[12px] text-secondary mt-0.5">{item.createdByName}</Text>
            </View>
            <Pressable onPress={() => onDelete(item.$id)} hitSlop={8}>
              <Ionicons name="trash-outline" size={17} color={t.labelTertiary} />
            </Pressable>
          </View>
        ))}
      </View>
    </>
  );
}
