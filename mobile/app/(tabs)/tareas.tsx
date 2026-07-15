import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { Screen } from "@/components/Screen";
import { PhaseCard, cardShadow } from "@/components/Card";
import { Avatar, CheckCircle, SectionTitle } from "@/components/ui";
import { useHogar } from "@/lib/hogar";
import { useAuth } from "@/lib/auth";
import { appwriteConfigured } from "@/lib/appwrite";
import { useTasks } from "@/lib/useTasks";
import { createTask, deleteTask, setTaskDone, type Task } from "@/lib/tasks";
import { useTheme } from "@/theme/theme";

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

const oops = (e: unknown) =>
  Alert.alert("No se pudo completar", e instanceof Error ? e.message : "Revisa tu conexión e inténtalo de nuevo.");

function TareasList({ hogarId, userName }: { hogarId: string; userName: string }) {
  const t = useTheme();
  const qc = useQueryClient();
  const { data: tasks, isLoading, isError } = useTasks(hogarId);
  const [title, setTitle] = useState("");
  const [adding, setAdding] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ["tasks", hogarId] });

  const add = async () => {
    const val = title.trim();
    if (!val) return;
    setAdding(true);
    setTitle("");
    try {
      await createTask(hogarId, val, userName);
      refresh();
    } catch (e) {
      oops(e);
    } finally {
      setAdding(false);
    }
  };

  const toggle = async (task: Task) => {
    try {
      await setTaskDone(task, !task.done);
      refresh();
    } catch (e) {
      oops(e);
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteTask(id);
      refresh();
    } catch (e) {
      oops(e);
    }
  };

  const pending = (tasks ?? []).filter((x) => !x.done);
  const done = (tasks ?? []).filter((x) => x.done);

  return (
    <Screen title="Tareas" subtitle={`${pending.length} pendientes`} onRefresh={refresh}>
      {isError && (
        <Text className="text-center text-[13px] mb-2" style={{ color: t.red }}>
          No se pudieron cargar las tareas. Desliza hacia abajo para reintentar.
        </Text>
      )}
      <View
        className="flex-row items-center bg-card rounded-pill mx-4 mb-4 px-4 py-2"
        style={{ gap: 8, borderWidth: 0.5, borderColor: t.separator, ...cardShadow(t.dark) }}
      >
        <Ionicons name="add" size={22} color={t.accent} />
        <TextInput
          className="flex-1 text-[16px] text-label"
          placeholder="Añadir tarea…"
          placeholderTextColor={t.labelTertiary}
          value={title}
          onChangeText={setTitle}
          onSubmitEditing={add}
          returnKeyType="done"
        />
        {adding && <ActivityIndicator color={t.accent} />}
      </View>

      {isLoading ? (
        <ActivityIndicator color={t.accent} style={{ marginTop: 24 }} />
      ) : (
        <>
          <Section title="Pendientes" tasks={pending} onToggle={toggle} onDelete={remove} />
          {done.length > 0 && <Section title="Completadas" tasks={done} onToggle={toggle} onDelete={remove} />}
          {pending.length === 0 && done.length === 0 && (
            <Text className="text-center text-tertiary mt-8">No hay tareas todavía. ¡Añade la primera!</Text>
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
  const t = useTheme();
  if (tasks.length === 0) return null;
  return (
    <>
      <SectionTitle>{title}</SectionTitle>
      <View className="bg-card rounded-lg2 mx-4 mb-3 overflow-hidden" style={cardShadow(t.dark)}>
        {tasks.map((task, i) => (
          <View
            key={task.$id}
            className="flex-row items-center px-4 py-3"
            style={{ gap: 12, borderTopWidth: i ? 0.5 : 0, borderTopColor: t.separator }}
          >
            <CheckCircle done={task.done} onPress={() => onToggle(task)} />
            <View className="flex-1">
              <Text
                className="text-[15px]"
                style={{
                  color: task.done ? t.labelTertiary : t.label,
                  textDecorationLine: task.done ? "line-through" : "none",
                }}
              >
                {task.title}
              </Text>
              <View className="flex-row items-center mt-1" style={{ gap: 6 }}>
                <Avatar name={task.createdByName} size={18} />
                <Text className="text-[12px] text-secondary">{task.createdByName}</Text>
              </View>
            </View>
            <Pressable onPress={() => onDelete(task.$id)} hitSlop={8}>
              <Ionicons name="trash-outline" size={17} color={t.labelTertiary} />
            </Pressable>
          </View>
        ))}
      </View>
    </>
  );
}
