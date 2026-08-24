import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { Screen } from "@/components/Screen";
import { PhaseCard, cardShadow } from "@/components/Card";
import { Avatar, AvatarStack, CheckCircle, SectionTitle } from "@/components/ui";
import { AddBar } from "@/components/AddBar";
import { SwipeToDelete } from "@/components/SwipeToDelete";
import { ListGroup, Row, RowIcon } from "@/components/List";
import { Segmented } from "@/components/Segmented";
import { TaskEditor } from "@/components/tareas/TaskEditor";
import { useHogar } from "@/lib/hogar";
import { useAuth } from "@/lib/auth";
import { appwriteConfigured } from "@/lib/appwrite";
import { useTasks } from "@/lib/useTasks";
import { completeTask, createTask, deleteTask, setTaskDone, type Task } from "@/lib/tasks";
import { useMembers } from "@/lib/useMembers";
import { householdNames } from "@/lib/members";
import { dueInfo, groupTasks, hiddenNoDate, repeatLabel, type TaskFilter } from "@/lib/taskLogic";
import { leadLabel } from "@/lib/leadTime";
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
  const [editing, setEditing] = useState<Task | "new" | null>(null);

  const [filter, setFilter] = useState<TaskFilter>("today");

  const refresh = () => qc.invalidateQueries({ queryKey: ["tasks", hogarId] });
  // Siempre me incluyo: si los miembros aún no han cargado, al menos estoy yo.
  const members = [...new Set([userName, ...householdNames(useMembers(hogarId).data ?? [])])];

  const add = async () => {
    const val = title.trim();
    if (!val) return;
    setAdding(true);
    setTitle("");
    try {
      await createTask(hogarId, { title: val, createdByName: userName });
      refresh();
    } catch (e) {
      oops(e);
    } finally {
      setAdding(false);
    }
  };

  const toggle = async (task: Task) => {
    try {
      if (task.done) await setTaskDone(task, false);
      else await completeTask(task);
      refresh();
    } catch (e) {
      oops(e);
    }
  };

  const remove = (task: Task) =>
    Alert.alert("Borrar tarea", `¿Borrar “${task.title}”?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Borrar",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteTask(task.$id);
            refresh();
          } catch (e) {
            oops(e);
          }
        },
      },
    ]);

  const all = tasks ?? [];
  const pending = all.filter((x) => !x.done);
  const groups = groupTasks(all, filter);
  // Las que no tienen fecha solo salen en "Todas". Si hay alguna escondida hay
  // que decirlo aquí mismo: si no, añades una desde la barra y parece que la app
  // se la ha tragado.
  const sinFecha = hiddenNoDate(all, filter);

  return (
    <Screen
      title="Tareas"
      subtitle={`${pending.length} pendientes`}
      onRefresh={refresh}
      contentBottom={120}
      floating={
        <AddBar
          placeholder="Añadir tarea…"
          value={title}
          onChange={setTitle}
          onSubmit={add}
          busy={adding}
          leadingIcon="checkmark-circle-outline"
          actionIcon="add"
          onAction={() => setEditing("new")}
        />
      }
    >
      {isError && (
        <Text className="text-center text-footnote mb-2" style={{ color: t.red }}>
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
          {pending.length === 0
            ? "No hay tareas todavía. ¡Añade la primera!"
            : sinFecha > 0
              ? "Nada con fecha en este periodo."
              : "Nada en este periodo. Cambia de pestaña."}
        </Text>
      ) : (
        groups.map((g) => (
          <Section key={g.key} title={g.title} tasks={g.tasks} members={members} onToggle={toggle} onEdit={setEditing} onDelete={remove} />
        ))
      )}

      {/* Se pinta SIEMPRE que haya alguna escondida, con lista o sin ella: el
          estado vacío no basta, porque con una sola tarea atrasada ya no se
          dibuja y es justo el caso en el que se pierde la recién añadida. */}
      {!isLoading && sinFecha > 0 && (
        <ListGroup>
          <Row
            first
            leading={<RowIcon icon="albums-outline" color={t.gray} />}
            title={`${sinFecha} ${sinFecha === 1 ? "tarea sin fecha" : "tareas sin fecha"}`}
            subtitle="Solo se ven en Todas"
            chevron
            onPress={() => setFilter("all")}
          />
        </ListGroup>
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
  members,
  onToggle,
  onEdit,
  onDelete,
}: {
  title: string;
  tasks: Task[];
  members: string[];
  onToggle: (t: Task) => void;
  onEdit: (t: Task) => void;
  onDelete: (t: Task) => void;
}) {
  const t = useTheme();
  if (tasks.length === 0) return null;
  return (
    <>
      <SectionTitle>{title}</SectionTitle>
      <ListGroup>
        {tasks.map((task, i) => (
          <SwipeToDelete key={task.$id} onDelete={() => onDelete(task)}>
            <Row
              first={i === 0}
              leading={<CheckCircle done={task.done} onPress={() => onToggle(task)} />}
              leadingWidth={23}
              chevron
              onPress={() => onEdit(task)}
              title={
                <Text
                  className="text-body"
                  style={{
                    color: task.done ? t.labelTertiary : t.label,
                    textDecorationLine: task.done ? "line-through" : "none",
                  }}
                >
                  {task.title}
                </Text>
              }
              subtitle={<TaskMeta task={task} members={members} />}
            />
          </SwipeToDelete>
        ))}
      </ListGroup>
    </>
  );
}

function TaskMeta({ task, members }: { task: Task; members: string[] }) {
  const t = useTheme();
  const repeat = task.repeat ?? "none";
  const assignee = (task.assignedToName ?? "").trim();
  // Sin asignar no es "de nadie": es de todos. Antes se quedaba en blanco.
  const shared = !assignee && members.length > 0;
  const hasMeta = task.dueAt || assignee || shared || repeat !== "none" || task.notify;
  if (!hasMeta) return null;

  const due = task.dueAt ? dueInfo(task.dueAt) : null;
  const overdue = !!due?.overdue && !task.done;

  return (
    <View className="flex-row items-center flex-wrap mt-1.5" style={{ gap: 8 }}>
      {due && (
        <View className="flex-row items-center rounded-pill px-2 py-0.5" style={{ gap: 4, backgroundColor: overdue ? t.red + "22" : t.fill }}>
          <Ionicons name="calendar-outline" size={11} color={overdue ? t.red : t.labelSecondary} />
          <Text className="text-caption2 font-medium" style={{ color: overdue ? t.red : t.labelSecondary }}>{due.label}</Text>
        </View>
      )}
      {repeat !== "none" && (
        <View className="flex-row items-center" style={{ gap: 3 }}>
          <Ionicons name="repeat" size={12} color={t.labelSecondary} />
          <Text className="text-caption2 text-secondary">
            {repeatLabel(repeat)}
            {task.repeatUntil ? ` · hasta ${shortDate(task.repeatUntil)}` : ""}
          </Text>
        </View>
      )}
      {task.notify && (
        <View className="flex-row items-center" style={{ gap: 3 }}>
          <Ionicons name="notifications" size={11} color={t.labelSecondary} />
          {(task.notifyLead ?? 0) > 0 && (
            <Text className="text-caption2 text-secondary">{leadLabel(task.notifyLead ?? 0)}</Text>
          )}
        </View>
      )}
      {assignee ? (
        <View className="flex-row items-center" style={{ gap: 4 }}>
          <Avatar name={assignee} size={16} />
          <Text className="text-caption2 text-secondary">{assignee}</Text>
        </View>
      ) : shared ? (
        <View className="flex-row items-center" style={{ gap: 4 }}>
          <AvatarStack names={members} size={16} />
          <Text className="text-caption2 text-secondary">Todos</Text>
        </View>
      ) : null}
    </View>
  );
}

const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const shortDate = (iso: string): string => {
  const d = new Date(iso);
  return isFinite(d.getTime()) ? `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}` : "";
};
