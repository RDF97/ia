import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { Screen } from "@/components/Screen";
import { PhaseCard } from "@/components/Card";
import { useHogar } from "@/lib/hogar";
import { useAuth } from "@/lib/auth";
import { appwriteConfigured } from "@/lib/appwrite";
import { useTasks } from "@/lib/useTasks";
import { createTask, deleteTask, setTaskDone, type Task } from "@/lib/tasks";
import { colors } from "@/theme/tokens";

export default function Tareas() {
  const { active } = useHogar();
  const { user } = useAuth();

  if (!appwriteConfigured || !active) {
    return (
      <Screen title="Tareas" subtitle="Reparto del hogar">
        <PhaseCard phase="Fase 2 · Tareas">
          Tareas compartidas en tiempo real entre los miembros del hogar. Se activa al
          configurar el backend y entrar en un hogar.
        </PhaseCard>
      </Screen>
    );
  }
  return <TareasList hogarId={active.$id} userName={user?.name || "Yo"} />;
}

function TareasList({ hogarId, userName }: { hogarId: string; userName: string }) {
  const qc = useQueryClient();
  const { data: tasks, isLoading } = useTasks(hogarId);
  const [title, setTitle] = useState("");
  const [adding, setAdding] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ["tasks", hogarId] });

  const add = async () => {
    const t = title.trim();
    if (!t) return;
    setAdding(true);
    setTitle("");
    try {
      await createTask(hogarId, t, userName);
      refresh();
    } finally {
      setAdding(false);
    }
  };

  const toggle = async (task: Task) => {
    await setTaskDone(task, !task.done);
    refresh();
  };

  const remove = async (id: string) => {
    await deleteTask(id);
    refresh();
  };

  const pending = (tasks ?? []).filter((t) => !t.done);
  const done = (tasks ?? []).filter((t) => t.done);

  return (
    <Screen title="Tareas" subtitle={`${pending.length} pendientes`}>
      {/* Añadir */}
      <View className="flex-row items-center bg-white rounded-lg2 mx-4 mb-4 px-3 py-2" style={{ gap: 8 }}>
        <Ionicons name="add" size={22} color={colors.accent} />
        <TextInput
          className="flex-1 text-[16px] text-black"
          placeholder="Añadir tarea…"
          placeholderTextColor={colors.labelSecondary}
          value={title}
          onChangeText={setTitle}
          onSubmitEditing={add}
          returnKeyType="done"
        />
        {adding && <ActivityIndicator color={colors.accent} />}
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      ) : (
        <>
          <Section title="Pendientes" tasks={pending} onToggle={toggle} onDelete={remove} />
          {done.length > 0 && (
            <Section title="Completadas" tasks={done} onToggle={toggle} onDelete={remove} />
          )}
          {pending.length === 0 && done.length === 0 && (
            <Text className="text-center text-neutral-400 mt-8">
              No hay tareas todavía. ¡Añade la primera!
            </Text>
          )}
        </>
      )}
    </Screen>
  );
}

function Section({
  title,
  tasks,
  onToggle,
  onDelete,
}: {
  title: string;
  tasks: Task[];
  onToggle: (t: Task) => void;
  onDelete: (id: string) => void;
}) {
  if (tasks.length === 0) return null;
  return (
    <>
      <Text className="px-5 pt-2 pb-2 text-[13px] font-medium uppercase tracking-wide text-neutral-500">
        {title}
      </Text>
      <View className="bg-white rounded-lg2 mx-4 mb-3 overflow-hidden">
        {tasks.map((t, i) => (
          <View
            key={t.$id}
            className="flex-row items-center px-4 py-3"
            style={{ gap: 12, borderTopWidth: i ? 0.5 : 0, borderTopColor: colors.separator }}
          >
            <Pressable onPress={() => onToggle(t)} hitSlop={8}>
              <Ionicons
                name={t.done ? "checkmark-circle" : "ellipse-outline"}
                size={24}
                color={t.done ? colors.green : colors.labelSecondary}
              />
            </Pressable>
            <View className="flex-1">
              <Text
                className="text-[16px]"
                style={{
                  color: t.done ? colors.labelSecondary : colors.label,
                  textDecorationLine: t.done ? "line-through" : "none",
                }}
              >
                {t.title}
              </Text>
              <Text className="text-[12px] text-neutral-500 mt-0.5">{t.createdByName}</Text>
            </View>
            <Pressable onPress={() => onDelete(t.$id)} hitSlop={8}>
              <Ionicons name="trash-outline" size={18} color={colors.labelSecondary} />
            </Pressable>
          </View>
        ))}
      </View>
    </>
  );
}
