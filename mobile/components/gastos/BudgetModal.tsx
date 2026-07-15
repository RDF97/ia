import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/theme/theme";
import { Toggle } from "@/components/Toggle";
import { useCategories } from "@/lib/useCategories";
import {
  CATEGORY_COLORS,
  CATEGORY_ICONS,
  createCategory,
  deleteCategory,
  seedDefaultCategories,
  updateCategory,
  type Category,
} from "@/lib/categories";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];
const eur = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;

export function BudgetModal({
  visible,
  hogarId,
  enabled,
  onToggle,
  onClose,
}: {
  visible: boolean;
  hogarId: string;
  enabled: boolean;
  onToggle: (on: boolean) => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const qc = useQueryClient();
  const { data: categories, isLoading } = useCategories(hogarId);
  const [editing, setEditing] = useState<Category | "new" | null>(null);
  const [seeding, setSeeding] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ["categories", hogarId] });
  const list = categories ?? [];

  const seed = async () => {
    setSeeding(true);
    try {
      await seedDefaultCategories(hogarId);
      refresh();
    } catch (e) {
      Alert.alert("No se pudo crear", e instanceof Error ? e.message : "Inténtalo de nuevo.");
    } finally {
      setSeeding(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1" style={{ backgroundColor: t.overlay }} onPress={onClose} />
      <View className="rounded-t-[14px] absolute left-0 right-0 bottom-0" style={{ height: "86%", backgroundColor: t.bg }}>
        <View className="items-center pt-2 pb-1">
          <View style={{ width: 36, height: 5, borderRadius: 999, backgroundColor: t.separator }} />
        </View>
        <View className="flex-row items-center justify-between px-5 py-3" style={{ borderBottomWidth: 0.5, borderBottomColor: t.separator }}>
          <Pressable onPress={onClose} hitSlop={8}><Text className="text-base text-accent">Cerrar</Text></Pressable>
          <Text className="text-[17px] font-semibold text-label">Categorías y presupuesto</Text>
          <View style={{ width: 52 }} />
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          {/* Interruptor */}
          <View className="bg-card rounded-lg2 mx-4 mt-3 px-4 py-3 flex-row items-center" style={{ gap: 12 }}>
            <View className="rounded-lg items-center justify-center" style={{ width: 30, height: 30, backgroundColor: t.accent }}>
              <Ionicons name="pie-chart" size={16} color="#fff" />
            </View>
            <View className="flex-1">
              <Text className="text-[15px] text-label">Presupuesto mensual</Text>
              <Text className="text-[12px] text-secondary mt-0.5">Muestra cuánto llevas gastado de cada límite</Text>
            </View>
            <Toggle value={enabled} onChange={onToggle} />
          </View>

          <Text className="px-5 pt-4 pb-2 text-xs font-medium uppercase tracking-wide text-secondary">
            Categorías
          </Text>

          {isLoading ? (
            <ActivityIndicator color={t.accent} style={{ marginTop: 16 }} />
          ) : list.length === 0 ? (
            <View className="mx-4">
              <Text className="text-center text-tertiary mb-3 px-6">
                Aún no tienes categorías. Empieza con unas sugeridas y edítalas a tu gusto.
              </Text>
              <Pressable
                onPress={seed}
                disabled={seeding}
                className="rounded-[14px] py-3.5 items-center"
                style={{ backgroundColor: t.accent, opacity: seeding ? 0.6 : 1 }}
              >
                {seeding ? <ActivityIndicator color="#fff" /> : <Text className="text-white text-base font-semibold">Usar categorías sugeridas</Text>}
              </Pressable>
            </View>
          ) : (
            <View className="bg-card rounded-lg2 mx-4 overflow-hidden">
              {list.map((c, i) => (
                <Pressable
                  key={c.$id}
                  onPress={() => setEditing(c)}
                  className="flex-row items-center px-4 py-3"
                  style={{ gap: 12, borderTopWidth: i ? 0.5 : 0, borderTopColor: t.separator }}
                >
                  <View className="rounded-lg items-center justify-center" style={{ width: 30, height: 30, backgroundColor: c.color }}>
                    <Ionicons name={c.icon as IoniconName} size={16} color="#fff" />
                  </View>
                  <Text className="flex-1 text-[15px] text-label">{c.name}</Text>
                  <Text className="text-[13px]" style={{ color: c.budget > 0 ? t.labelSecondary : t.labelTertiary }}>
                    {c.budget > 0 ? `${eur(c.budget)}/mes` : "Sin límite"}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={t.tabInactive} />
                </Pressable>
              ))}
            </View>
          )}

          {list.length > 0 && (
            <Pressable
              onPress={() => setEditing("new")}
              className="flex-row items-center justify-center mx-4 mt-3 py-3 rounded-[14px]"
              style={{ gap: 8, borderWidth: 1, borderColor: t.separator }}
            >
              <Ionicons name="add" size={20} color={t.accent} />
              <Text className="text-[15px] font-semibold text-accent">Nueva categoría</Text>
            </Pressable>
          )}
        </ScrollView>
      </View>

      <CategoryEditor
        target={editing}
        hogarId={hogarId}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          refresh();
        }}
      />
    </Modal>
  );
}

function CategoryEditor({
  target,
  hogarId,
  onClose,
  onSaved,
}: {
  target: Category | "new" | null;
  hogarId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTheme();
  const isNew = target === "new";
  const cat = target && target !== "new" ? target : null;

  const [name, setName] = useState("");
  const [color, setColor] = useState(CATEGORY_COLORS[0]);
  const [icon, setIcon] = useState(CATEGORY_ICONS[0]);
  const [budget, setBudget] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!target) return;
    if (cat) {
      setName(cat.name);
      setColor(cat.color);
      setIcon(cat.icon);
      setBudget(cat.budget > 0 ? String(cat.budget).replace(".", ",") : "");
    } else {
      setName("");
      setColor(CATEGORY_COLORS[0]);
      setIcon(CATEGORY_ICONS[0]);
      setBudget("");
    }
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!name.trim()) return;
    const b = budget.trim() ? parseFloat(budget.replace(",", ".")) : 0;
    const budgetValue = isFinite(b) && b > 0 ? b : 0;
    setBusy(true);
    try {
      if (cat) await updateCategory(cat.$id, { name, color, icon, budget: budgetValue });
      else await createCategory(hogarId, { name, color, icon, budget: budgetValue });
      onSaved();
    } catch (e) {
      Alert.alert("No se pudo guardar", e instanceof Error ? e.message : "Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    if (!cat) return;
    Alert.alert("Borrar categoría", `¿Borrar “${cat.name}”? Los gastos ya guardados no se ven afectados.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Borrar",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteCategory(cat.$id);
            onSaved();
          } catch (e) {
            Alert.alert("No se pudo borrar", e instanceof Error ? e.message : "Inténtalo de nuevo.");
          }
        },
      },
    ]);
  };

  return (
    <Modal visible={target !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1" style={{ backgroundColor: t.overlay }} onPress={onClose} />
      <View className="rounded-t-[14px] absolute left-0 right-0 bottom-0 p-5" style={{ paddingBottom: 32, backgroundColor: t.bg }}>
        <View className="flex-row items-center mb-4" style={{ gap: 12 }}>
          <View className="rounded-lg items-center justify-center" style={{ width: 34, height: 34, backgroundColor: color }}>
            <Ionicons name={icon as IoniconName} size={18} color="#fff" />
          </View>
          <Text className="text-[17px] font-semibold text-label">{isNew ? "Nueva categoría" : "Editar categoría"}</Text>
        </View>

        <TextInput
          className="bg-card rounded-lg2 px-4 py-3 mb-3 text-[16px] text-label"
          placeholder="Nombre (p. ej. Alimentación)"
          placeholderTextColor={t.labelTertiary}
          value={name}
          onChangeText={setName}
          autoCapitalize="sentences"
        />

        <View className="flex-row items-center bg-card rounded-lg2 px-4 py-3 mb-4" style={{ gap: 8 }}>
          <Text className="flex-1 text-[15px] text-label">Límite mensual</Text>
          <TextInput
            className="text-[16px] text-label text-right"
            style={{ minWidth: 90 }}
            placeholder="Sin límite"
            placeholderTextColor={t.labelTertiary}
            value={budget}
            onChangeText={setBudget}
            keyboardType="decimal-pad"
          />
          <Text className="text-[15px] text-secondary">€</Text>
        </View>

        <Text className="text-xs font-medium uppercase tracking-wide text-secondary mb-2">Color</Text>
        <View className="flex-row flex-wrap mb-4" style={{ gap: 10 }}>
          {CATEGORY_COLORS.map((c) => (
            <Pressable key={c} onPress={() => setColor(c)} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c, alignItems: "center", justifyContent: "center" }}>
              {c === color && <Ionicons name="checkmark" size={16} color="#fff" />}
            </Pressable>
          ))}
        </View>

        <Text className="text-xs font-medium uppercase tracking-wide text-secondary mb-2">Icono</Text>
        <View className="flex-row flex-wrap mb-5" style={{ gap: 10 }}>
          {CATEGORY_ICONS.map((ic) => {
            const on = ic === icon;
            return (
              <Pressable
                key={ic}
                onPress={() => setIcon(ic)}
                style={{ width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: on ? color : t.fill }}
              >
                <Ionicons name={ic as IoniconName} size={19} color={on ? "#fff" : t.label} />
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={save}
          disabled={busy || !name.trim()}
          className="rounded-[14px] py-3.5 items-center"
          style={{ backgroundColor: t.accent, opacity: busy || !name.trim() ? 0.6 : 1 }}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text className="text-white text-base font-semibold">Guardar</Text>}
        </Pressable>

        {cat && (
          <Pressable onPress={remove} className="mt-3 items-center py-1">
            <Text className="text-[14px]" style={{ color: t.red }}>Borrar categoría</Text>
          </Pressable>
        )}
      </View>
    </Modal>
  );
}
