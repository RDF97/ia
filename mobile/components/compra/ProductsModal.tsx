import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/theme/tokens";
import {
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

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/40" onPress={onClose} />
      <View className="bg-bg-app rounded-t-[14px] absolute left-0 right-0 bottom-0" style={{ height: "82%" }}>
        <View className="items-center pt-2 pb-1">
          <View style={{ width: 36, height: 5, borderRadius: 999, backgroundColor: "#0000002e" }} />
        </View>
        <View className="flex-row items-center justify-between px-5 py-3 border-b border-neutral-200">
          {selected ? (
            <Pressable onPress={() => setSelected(null)}>
              <Text className="text-base text-accent">‹ Volver</Text>
            </Pressable>
          ) : (
            <Pressable onPress={onClose}>
              <Text className="text-base text-accent">Cerrar</Text>
            </Pressable>
          )}
          <Text className="text-[17px] font-semibold">
            {selected ? selected.name : "Base de precios"}
          </Text>
          <View style={{ width: 52 }} />
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 28 }}>
          {!selected ? (
            products === null ? (
              <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
            ) : products.length === 0 ? (
              <Text className="text-center text-neutral-400 mt-8 px-8">
                Aún no hay productos. Al marcar algo como comprado podrás apuntar su precio y súper,
                y aquí verás el histórico.
              </Text>
            ) : (
              <View className="bg-white rounded-lg2 mx-4 mt-3 overflow-hidden">
                {products.map((p, i) => (
                  <Pressable
                    key={p.$id}
                    onPress={() => setSelected(p)}
                    className="flex-row items-center px-4 py-3"
                    style={{ gap: 12, borderTopWidth: i ? 0.5 : 0, borderTopColor: colors.separator }}
                  >
                    <View className="flex-1">
                      <Text className="text-[16px] font-medium text-black">{p.name}</Text>
                      {p.lastStore ? (
                        <Text className="text-[12px] text-neutral-500 mt-0.5">
                          {p.lastStore}
                          {p.lastAt ? ` · ${fecha(p.lastAt)}` : ""}
                        </Text>
                      ) : null}
                    </View>
                    {typeof p.lastPrice === "number" && (
                      <Text className="text-[15px] font-semibold text-black">{eur(p.lastPrice)}</Text>
                    )}
                    <Ionicons name="chevron-forward" size={16} color={colors.tabInactive} />
                  </Pressable>
                ))}
              </View>
            )
          ) : points === null ? (
            <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
          ) : (
            <ProductDetail points={points} />
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function ProductDetail({ points }: { points: PricePoint[] }) {
  const byStore = latestByStore(points);
  return (
    <>
      <Text className="px-5 pt-4 pb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
        Comparativa por supermercado
      </Text>
      {byStore.length === 0 ? (
        <Text className="text-center text-neutral-400 mt-2">Sin precios registrados.</Text>
      ) : (
        <View className="bg-white rounded-lg2 mx-4 overflow-hidden">
          {byStore.map((s, i) => (
            <View
              key={s.store}
              className="flex-row items-center px-4 py-3"
              style={{
                gap: 12,
                borderTopWidth: i ? 0.5 : 0,
                borderTopColor: colors.separator,
                backgroundColor: i === 0 ? "rgba(52,199,89,0.08)" : undefined,
              }}
            >
              {i === 0 && <Ionicons name="trophy" size={16} color={colors.green} />}
              <Text className="flex-1 text-[15px] font-medium text-black">{s.store}</Text>
              <View style={{ alignItems: "flex-end" }}>
                <Text className="text-[15px] font-semibold" style={{ color: i === 0 ? colors.green : colors.label }}>
                  {eur(s.price)}
                </Text>
                <Text className="text-[11px] text-neutral-400">{fecha(s.at)}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      <Text className="px-5 pt-4 pb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
        Últimas compras
      </Text>
      <View className="bg-white rounded-lg2 mx-4 mb-4 overflow-hidden">
        {points.slice(0, 15).map((p, i) => (
          <View
            key={p.$id}
            className="flex-row items-center px-4 py-3"
            style={{ gap: 12, borderTopWidth: i ? 0.5 : 0, borderTopColor: colors.separator }}
          >
            <Text className="flex-1 text-[14px] text-black">
              {fecha(p.at)} · {p.store}
            </Text>
            <Text className="text-[14px] font-semibold text-black">{eur(p.price)}</Text>
          </View>
        ))}
      </View>
    </>
  );
}
