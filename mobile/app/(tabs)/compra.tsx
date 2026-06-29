import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { Screen } from "@/components/Screen";
import { PhaseCard } from "@/components/Card";
import { useHogar } from "@/lib/hogar";
import { useAuth } from "@/lib/auth";
import { appwriteConfigured } from "@/lib/appwrite";
import { useShopping } from "@/lib/useShopping";
import { addItem, deleteItem, setItemDone, type ShoppingItem } from "@/lib/shopping";
import { colors } from "@/theme/tokens";

export default function Compra() {
  const { active } = useHogar();
  const { user } = useAuth();

  if (!appwriteConfigured || !active) {
    return (
      <Screen title="Compra" subtitle="Lista colaborativa">
        <PhaseCard phase="Fase 3 · Compra">
          Lista de la compra compartida en tiempo real. Después llegan la base de datos de
          productos con histórico de precios y el OCR de tickets.
        </PhaseCard>
      </Screen>
    );
  }
  return <CompraList hogarId={active.$id} userName={user?.name || "Yo"} />;
}

function CompraList({ hogarId, userName }: { hogarId: string; userName: string }) {
  const qc = useQueryClient();
  const { data: items, isLoading } = useShopping(hogarId);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ["shopping", hogarId] });

  const add = async () => {
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    setName("");
    try {
      await addItem(hogarId, n, userName);
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (item: ShoppingItem) => {
    await setItemDone(item, !item.done);
    refresh();
  };

  const remove = async (id: string) => {
    await deleteItem(id);
    refresh();
  };

  const pending = (items ?? []).filter((i) => !i.done);
  const bought = (items ?? []).filter((i) => i.done);

  return (
    <Screen title="Compra" subtitle={`${pending.length} por comprar`}>
      <View className="flex-row items-center bg-white rounded-lg2 mx-4 mb-4 px-3 py-2" style={{ gap: 8 }}>
        <Ionicons name="add" size={22} color={colors.accent} />
        <TextInput
          className="flex-1 text-[16px] text-black"
          placeholder="Añadir a la lista…"
          placeholderTextColor={colors.labelSecondary}
          value={name}
          onChangeText={setName}
          onSubmitEditing={add}
          returnKeyType="done"
        />
        {busy && <ActivityIndicator color={colors.accent} />}
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      ) : (
        <>
          <Section title="Por comprar" items={pending} onToggle={toggle} onDelete={remove} />
          {bought.length > 0 && (
            <Section title="Comprado" items={bought} onToggle={toggle} onDelete={remove} />
          )}
          {pending.length === 0 && bought.length === 0 && (
            <Text className="text-center text-neutral-400 mt-8">
              Lista vacía. ¡Añade el primer producto!
            </Text>
          )}
        </>
      )}
    </Screen>
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
  if (items.length === 0) return null;
  return (
    <>
      <Text className="px-5 pt-2 pb-2 text-[13px] font-medium uppercase tracking-wide text-neutral-500">
        {title}
      </Text>
      <View className="bg-white rounded-lg2 mx-4 mb-3 overflow-hidden">
        {items.map((item, i) => (
          <View
            key={item.$id}
            className="flex-row items-center px-4 py-3"
            style={{ gap: 12, borderTopWidth: i ? 0.5 : 0, borderTopColor: colors.separator }}
          >
            <Pressable onPress={() => onToggle(item)} hitSlop={8}>
              <Ionicons
                name={item.done ? "checkmark-circle" : "ellipse-outline"}
                size={24}
                color={item.done ? colors.green : colors.labelSecondary}
              />
            </Pressable>
            <View className="flex-1">
              <Text
                className="text-[16px]"
                style={{
                  color: item.done ? colors.labelSecondary : colors.label,
                  textDecorationLine: item.done ? "line-through" : "none",
                }}
              >
                {item.name}
                {item.qty ? <Text className="text-neutral-500">  {item.qty}</Text> : null}
              </Text>
              <Text className="text-[12px] text-neutral-500 mt-0.5">{item.createdByName}</Text>
            </View>
            <Pressable onPress={() => onDelete(item.$id)} hitSlop={8}>
              <Ionicons name="trash-outline" size={18} color={colors.labelSecondary} />
            </Pressable>
          </View>
        ))}
      </View>
    </>
  );
}
