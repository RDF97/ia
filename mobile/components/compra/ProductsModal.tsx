import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SectionTitle } from "@/components/ui";
import { useTheme } from "@/theme/theme";
import { useKeyboardHeight } from "@/lib/useKeyboard";
import {
  deleteProduct,
  latestByStore,
  listPricePoints,
  listProducts,
  type PricePoint,
  type Product,
} from "@/lib/products";

const eur = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;
const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" });

export function ProductsModal({
  visible,
  hogarId,
  onClose,
}: {
  visible: boolean;
  hogarId: string;
  onClose: () => void;
}) {
  const t = useTheme();
  const kb = useKeyboardHeight();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [selected, setSelected] = useState<Product | null>(null);
  const [points, setPoints] = useState<PricePoint[] | null>(null);

  useEffect(() => {
    if (!visible) return;
    setSelected(null);
    setProducts(null);
    listProducts(hogarId).then(setProducts).catch(() => setProducts([]));
  }, [visible, hogarId]);

  useEffect(() => {
    if (!selected) return;
    setPoints(null);
    listPricePoints(selected.$id).then(setPoints).catch(() => setPoints([]));
  }, [selected]);

  const removeProduct = (p: Product) =>
    Alert.alert(
      "Borrar producto",
      `Se borrará “${p.name}” y todo su histórico de precios. ¿Seguro?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Borrar",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteProduct(p.$id);
              setSelected(null);
              setProducts((prev) => (prev ?? []).filter((x) => x.$id !== p.$id));
            } catch (e) {
              Alert.alert("No se pudo borrar", e instanceof Error ? e.message : "Inténtalo de nuevo.");
            }
          },
        },
      ],
    );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1" style={{ backgroundColor: t.overlay }} onPress={onClose} />
      <View className="rounded-t-sheet absolute left-0 right-0 bottom-0" style={{ height: "82%", backgroundColor: t.bg, paddingBottom: kb }}>
        <View className="items-center pt-2 pb-1">
          <View style={{ width: 36, height: 5, borderRadius: 999, backgroundColor: t.separator }} />
        </View>
        <View className="flex-row items-center justify-between px-5 py-3" style={{ borderBottomWidth: 0.5, borderBottomColor: t.separator }}>
          {selected ? (
            <Pressable onPress={() => setSelected(null)}>
              <Text className="text-callout text-accent">‹ Volver</Text>
            </Pressable>
          ) : (
            <Pressable onPress={onClose}>
              <Text className="text-callout text-accent">Cerrar</Text>
            </Pressable>
          )}
          <Text className="text-headline font-semibold text-label">
            {selected ? selected.name : "Base de precios"}
          </Text>
          {selected ? (
            <Pressable onPress={() => removeProduct(selected)} hitSlop={8} style={{ width: 52, alignItems: "flex-end" }}>
              <Ionicons name="trash-outline" size={20} color={t.red} />
            </Pressable>
          ) : (
            <View style={{ width: 52 }} />
          )}
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 28 }}>
          {!selected && products && products.length > 0 && (
            <Text className="text-center text-caption1 text-tertiary pt-3">
              Toca la papelera para borrar un producto y su histórico.
            </Text>
          )}
          {!selected ? (
            products === null ? (
              <ActivityIndicator color={t.accent} style={{ marginTop: 24 }} />
            ) : products.length === 0 ? (
              <Text className="text-center text-tertiary mt-8 px-8">
                Aún no hay productos. Al marcar algo como comprado podrás apuntar su precio y súper,
                y aquí verás el histórico.
              </Text>
            ) : (
              <View className="bg-card rounded-lg2 mx-4 mt-3 overflow-hidden">
                {products.map((p, i) => (
                  <Pressable
                    key={p.$id}
                    onPress={() => setSelected(p)}
                    className="flex-row items-center px-4 py-3"
                    style={{ gap: 12, borderTopWidth: i ? 0.5 : 0, borderTopColor: t.separator }}
                  >
                    <View className="flex-1">
                      <Text className="text-callout font-medium text-label">{p.name}</Text>
                      {p.lastStore ? (
                        <Text className="text-caption1 text-secondary mt-0.5">
                          {p.lastStore}
                          {p.lastAt ? ` · ${fecha(p.lastAt)}` : ""}
                        </Text>
                      ) : null}
                    </View>
                    {typeof p.lastPrice === "number" && (
                      <Text className="text-subhead font-semibold text-label">{eur(p.lastPrice)}</Text>
                    )}
                    <Pressable onPress={() => removeProduct(p)} hitSlop={10} style={{ padding: 4 }}>
                      <Ionicons name="trash-outline" size={18} color={t.red} />
                    </Pressable>
                    <Ionicons name="chevron-forward" size={16} color={t.tabInactive} />
                  </Pressable>
                ))}
              </View>
            )
          ) : points === null ? (
            <ActivityIndicator color={t.accent} style={{ marginTop: 24 }} />
          ) : (
            <ProductDetail points={points} />
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function ProductDetail({ points }: { points: PricePoint[] }) {
  const t = useTheme();
  const byStore = latestByStore(points);
  return (
    <>
      <SectionTitle>Comparativa por supermercado</SectionTitle>
      {byStore.length === 0 ? (
        <Text className="text-center text-tertiary mt-2">Sin precios registrados.</Text>
      ) : (
        <View className="bg-card rounded-lg2 mx-4 overflow-hidden">
          {byStore.map((s, i) => (
            <View
              key={s.store}
              className="flex-row items-center px-4 py-3"
              style={{
                gap: 12,
                borderTopWidth: i ? 0.5 : 0,
                borderTopColor: t.separator,
                backgroundColor: i === 0 ? (t.dark ? "rgba(48,209,88,0.14)" : "rgba(52,199,89,0.08)") : undefined,
              }}
            >
              {i === 0 && <Ionicons name="trophy" size={16} color={t.green} />}
              <Text className="flex-1 text-subhead font-medium text-label">{s.store}</Text>
              <View style={{ alignItems: "flex-end" }}>
                <Text className="text-subhead font-semibold" style={{ color: i === 0 ? t.green : t.label }}>
                  {eur(s.price)}
                </Text>
                <Text className="text-caption2 text-tertiary">{fecha(s.at)}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      <SectionTitle>Últimas compras</SectionTitle>
      <View className="bg-card rounded-lg2 mx-4 mb-4 overflow-hidden">
        {points.slice(0, 15).map((p, i) => (
          <View
            key={p.$id}
            className="flex-row items-center px-4 py-3"
            style={{ gap: 12, borderTopWidth: i ? 0.5 : 0, borderTopColor: t.separator }}
          >
            <Text className="flex-1 text-subhead text-label">
              {fecha(p.at)} · {p.store}
            </Text>
            <Text className="text-subhead font-semibold text-label">{eur(p.price)}</Text>
          </View>
        ))}
      </View>
    </>
  );
}
