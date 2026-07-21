import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { Screen } from "@/components/Screen";
import { PhaseCard, cardShadow } from "@/components/Card";
import { Avatar, CheckCircle, Fab, SectionTitle } from "@/components/ui";
import { Segmented } from "@/components/Segmented";
import { TaskEditor } from "@/components/tareas/TaskEditor";
import { useHogar } from "@/lib/hogar";
import { useAuth } from "@/lib/auth";
import { appwriteConfigured } from "@/lib/appwrite";
import { useTasks } from "@/lib/useTasks";
import { completeTask, listMemberNames, setTaskDone, type Task } from "@/lib/tasks";
import { dueInfo, groupTasks, repeatLabel, type TaskFilter } from "@/lib/taskLogic";
import { syncTaskReminders } from "@/lib/taskReminders";
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
  const [editing, setEditing] = useState<Task | "new" | null>(null);
  const [members, setMembers] = useState<string[]>([]);
  const [filter, setFilter] = useState<TaskFilter>("today");

  const refresh = () => qc.invalidateQueries({ queryKey: ["tasks", hogarId] });

  useEffect(() => {
    listMemberNames(hogarId).then(setMembers).catch(() => setMembers([]));
  }, [hogarId]);

  // Programa/actualiza los recordatorios locales según las tareas.
  useEffect(() => {
    if (tasks) syncTaskReminders(tasks, userName).catch(() => undefined);
  }, [tasks, userName]);

  const toggle = async (task: Task) => {
    try {
      if (task.done) await setTaskDone(task, false);
      else await completeTask(task);
      refresh();
    } catch (e) {
      oops(e);
    }
  };

  const all = tasks ?? [];
  const pending = all.filter((x) => !x.done);
  const groups = groupTasks(all, filter);

  return (
    <Screen
      title="Tareas"
      subtitle={`${pending.length} pendientes`}
      onRefresh={refresh}
      contentBottom={120}
      floating={<Fab onPress={() => setEditing("new")} />}
    >
      {isError && (
        <Text className="text-center text-[13px] mb-2" style={{ color: t.red }}>
          No se pudieron cargar las tareas. Desliza hacia abajo para reintentar.
        </Text>
      )}

      <Segmented
        value={filter}
        onChange={setFilter}
        options={[
          { key: "today", label: "Hoy" },
          { key: "week", label: "Semana" },
          { key: "all", label: "Todas" },
        ]}
      />

      {isLoading ? (
        <ActivityIndicator color={t.accent} style={{ marginTop: 24 }} />
      ) : groups.length === 0 ? (
        <Text className="text-center text-tertiary mt-8">
          {pending.length === 0 ? "No hay tareas todavía. ¡Añade la primera!" : "Nada en este periodo. Cambia de pestaña."}
        </Text>
      ) : (
        groups.map((g) => <Section key={g.key} title={g.title} tasks={g.tasks} onToggle={toggle} onEdit={setEditing} />)
      )}

      <TaskEditor
        target={editing}
        hogarId={hogarId}
        userName={userName}
        members={members}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          refresh();
        }}
      />
    </Screen>
  );
}

function Section({
  title,
  tasks,
  onToggle,
  onEdit,
}: {
  title: string;
  tasks: Task[];
  onToggle: (t: Task) => void;
  onEdit: (t: Task) => void;
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
            <Pressable className="flex-1" onPress={() => onEdit(task)}>
              <Text
                className="text-[15px]"
                style={{
                  color: task.done ? t.labelTertiary : t.label,
                  textDecorationLine: task.done ? "line-through" : "none",
                }}
              >
                {task.title}
              </Text>
              <TaskMeta task={task} />
            </Pressable>
            <Ionicons name="chevron-forward" size={16} color={t.tabInactive} />
          </View>
        ))}
      </View>
    </>
  );
}

function TaskMeta({ task }: { task: Task }) {
  const t = useTheme();
  const repeat = task.repeat ?? "none";
  const hasMeta = task.dueAt || task.assignedToName || repeat !== "none" || task.notify;
  if (!hasMeta) return null;

  const due = task.dueAt ? dueInfo(task.dueAt) : null;
  const overdue = !!due?.overdue && !task.done;

  return (
    <View className="flex-row items-center flex-wrap mt-1.5" style={{ gap: 8 }}>
      {due && (
        <View className="flex-row items-center rounded-pill px-2 py-0.5" style={{ gap: 4, backgroundColor: overdue ? t.red + "22" : t.fill }}>
          <Ionicons name="calendar-outline" size={11} color={overdue ? t.red : t.labelSecondary} />
          <Text className="text-[11px] font-medium" style={{ color: overdue ? t.red : t.labelSecondary }}>{due.label}</Text>
        </View>
      )}
      {repeat !== "none" && (
        <View className="flex-row items-center" style={{ gap: 3 }}>
          <Ionicons name="repeat" size={12} color={t.labelSecondary} />
          <Text className="text-[11px] text-secondary">{repeatLabel(repeat)}</Text>
        </View>
      )}
      {task.notify && <Ionicons name="notifications" size={11} color={t.labelSecondary} />}
      {task.assignedToName && (
        <View className="flex-row items-center" style={{ gap: 4 }}>
          <Avatar name={task.assignedToName} size={16} />
          <Text className="text-[11px] text-secondary">{task.assignedToName}</Text>
        </View>
      )}
    </View>
  );
}
