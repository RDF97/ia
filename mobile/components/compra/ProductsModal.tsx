import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/theme/theme";
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
  const t = useTheme();
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
      <Pressable className="flex-1" style={{ backgroundColor: t.overlay }} onPress={onClose} />
      <View className="rounded-t-[14px] absolute left-0 right-0 bottom-0" style={{ height: "82%", backgroundColor: t.bg }}>
        <View className="items-center pt-2 pb-1">
          <View style={{ width: 36, height: 5, borderRadius: 999, backgroundColor: t.separator }} />
        </View>
        <View className="flex-row items-center justify-between px-5 py-3" style={{ borderBottomWidth: 0.5, borderBottomColor: t.separator }}>
          {selected ? (
            <Pressable onPress={() => setSelected(null)}>
              <Text className="text-base text-accent">‹ Volver</Text>
            </Pressable>
          ) : (
            <Pressable onPress={onClose}>
              <Text className="text-base text-accent">Cerrar</Text>
            </Pressable>
          )}
          <Text className="text-[17px] font-semibold text-label">
            {selected ? selected.name : "Base de precios"}
          </Text>
          <View style={{ width: 52 }} />
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 28 }}>
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
                      <Text className="text-[16px] font-medium text-label">{p.name}</Text>
                      {p.lastStore ? (
                        <Text className="text-[12px] text-secondary mt-0.5">
                          {p.lastStore}
                          {p.lastAt ? ` · ${fecha(p.lastAt)}` : ""}
                        </Text>
                      ) : null}
                    </View>
                    {typeof p.lastPrice === "number" && (
                      <Text className="text-[15px] font-semibold text-label">{eur(p.lastPrice)}</Text>
                    )}
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
      <Text className="px-5 pt-4 pb-2 text-xs font-medium uppercase tracking-wide text-secondary">
        Comparativa por supermercado
      </Text>
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
              <Text className="flex-1 text-[15px] font-medium text-label">{s.store}</Text>
              <View style={{ alignItems: "flex-end" }}>
                <Text className="text-[15px] font-semibold" style={{ color: i === 0 ? t.green : t.label }}>
                  {eur(s.price)}
                </Text>
                <Text className="text-[11px] text-tertiary">{fecha(s.at)}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      <Text className="px-5 pt-4 pb-2 text-xs font-medium uppercase tracking-wide text-secondary">
        Últimas compras
      </Text>
      <View className="bg-card rounded-lg2 mx-4 mb-4 overflow-hidden">
        {points.slice(0, 15).map((p, i) => (
          <View
            key={p.$id}
            className="flex-row items-center px-4 py-3"
            style={{ gap: 12, borderTopWidth: i ? 0.5 : 0, borderTopColor: t.separator }}
          >
            <Text className="flex-1 text-[14px] text-label">
              {fecha(p.at)} · {p.store}
            </Text>
            <Text className="text-[14px] font-semibold text-label">{eur(p.price)}</Text>
          </View>
        ))}
      </View>
    </>
  );
}
