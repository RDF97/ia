import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useTheme } from "@/theme/theme";
import { Toggle } from "@/components/Toggle";
import { Avatar } from "@/components/ui";
import { REPEAT_OPTIONS, type Repeat } from "@/lib/taskLogic";
import { createTask, deleteTask, updateTask, type Task } from "@/lib/tasks";
import { ensureNotificationPermissions } from "@/lib/notifications";

export function TaskEditor({
  target,
  hogarId,
  userName,
  members,
  onClose,
  onSaved,
}: {
  target: Task | "new" | null;
  hogarId: string;
  userName: string;
  members: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTheme();
  const isNew = target === "new";
  const task = target && target !== "new" ? target : null;

  const [title, setTitle] = useState("");
  const [assigned, setAssigned] = useState<string | null>(null);
  const [hasDate, setHasDate] = useState(false);
  const [when, setWhen] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return d;
  });
  const [repeat, setRepeat] = useState<Repeat>("none");
  const [notify, setNotify] = useState(false);
  const [picker, setPicker] = useState<null | "date" | "time">(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!target) return;
    if (task) {
      setTitle(task.title);
      setAssigned(task.assignedToName ?? null);
      setRepeat(task.repeat ?? "none");
      setNotify(task.notify ?? false);
      if (task.dueAt) {
        setHasDate(true);
        setWhen(new Date(task.dueAt));
      } else {
        setHasDate(false);
      }
    } else {
      setTitle("");
      setAssigned(null);
      setRepeat("none");
      setNotify(false);
      setHasDate(false);
      const d = new Date();
      d.setHours(d.getHours() + 1, 0, 0, 0);
      setWhen(d);
    }
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPick = (_e: DateTimePickerEvent, d?: Date) => {
    setPicker(null);
    if (d) setWhen(d);
  };

  const memberList = [...new Set([userName, ...members].filter((n) => n && n.trim()))];

  const save = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      if (notify && hasDate) await ensureNotificationPermissions();
      const dueAt = hasDate ? when.toISOString() : null;
      const payload = {
        title: title.trim(),
        assignedToName: assigned,
        dueAt,
        repeat: hasDate ? repeat : "none",
        notify: hasDate ? notify : false,
      } as const;
      if (task) await updateTask(task.$id, payload);
      else await createTask(hogarId, { createdByName: userName, ...payload });
      onSaved();
    } catch (e) {
      Alert.alert("No se pudo guardar", e instanceof Error ? e.message : "Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    if (!task) return;
    Alert.alert("Borrar tarea", `¿Borrar “${task.title}”?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Borrar",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteTask(task.$id);
            onSaved();
          } catch (e) {
            Alert.alert("No se pudo borrar", e instanceof Error ? e.message : "Inténtalo de nuevo.");
          }
        },
      },
    ]);
  };

  const dateLabel = `${when.getDate()}/${when.getMonth() + 1}/${when.getFullYear()}`;
  const timeLabel = `${String(when.getHours()).padStart(2, "0")}:${String(when.getMinutes()).padStart(2, "0")}`;

  return (
    <Modal visible={target !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1" style={{ backgroundColor: t.overlay }} onPress={onClose} />
      <View className="rounded-t-[14px] absolute left-0 right-0 bottom-0" style={{ maxHeight: "90%", backgroundColor: t.bg }}>
        <View className="flex-row items-center justify-between px-5 py-3" style={{ borderBottomWidth: 0.5, borderBottomColor: t.separator }}>
          <Pressable onPress={onClose} hitSlop={8}><Text className="text-base text-accent">Cancelar</Text></Pressable>
          <Text className="text-[17px] font-semibold text-label">{isNew ? "Nueva tarea" : "Editar tarea"}</Text>
          <Pressable onPress={save} disabled={busy || !title.trim()} hitSlop={8}>
            <Text className="text-base font-semibold" style={{ color: t.accent, opacity: busy || !title.trim() ? 0.4 : 1 }}>Listo</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }}>
          <TextInput
            className="bg-card rounded-lg2 px-4 py-3 mb-4 text-[16px] text-label"
            placeholder="¿Qué hay que hacer?"
            placeholderTextColor={t.labelTertiary}
            value={title}
            onChangeText={setTitle}
            autoCapitalize="sentences"
          />

          {/* Asignar */}
          <Text className="text-xs font-medium uppercase tracking-wide text-secondary mb-2">Asignar a</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4" contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
            <Chip on={assigned === null} label="Cualquiera" onPress={() => setAssigned(null)} />
            {memberList.map((m) => (
              <Chip key={m} on={assigned === m} label={m} avatar onPress={() => setAssigned(m)} />
            ))}
          </ScrollView>

          {/* Fecha */}
          <View className="bg-card rounded-lg2 px-4 py-3 mb-3 flex-row items-center" style={{ gap: 12 }}>
            <Ionicons name="calendar-outline" size={19} color={t.accent} />
            <Text className="flex-1 text-[15px] text-label">Fecha y hora</Text>
            <Toggle value={hasDate} onChange={setHasDate} />
          </View>

          {hasDate && (
            <>
              <View className="flex-row mb-3" style={{ gap: 8 }}>
                <Pressable onPress={() => setPicker("date")} className="flex-1 bg-card rounded-lg2 px-4 py-3 flex-row items-center justify-center" style={{ gap: 8 }}>
                  <Ionicons name="calendar-outline" size={17} color={t.accent} />
                  <Text className="text-[15px] text-label">{dateLabel}</Text>
                </Pressable>
                <Pressable onPress={() => setPicker("time")} className="flex-1 bg-card rounded-lg2 px-4 py-3 flex-row items-center justify-center" style={{ gap: 8 }}>
                  <Ionicons name="time-outline" size={17} color={t.accent} />
                  <Text className="text-[15px] text-label">{timeLabel}</Text>
                </Pressable>
              </View>

              {picker && (
                <DateTimePicker value={when} mode={picker} is24Hour onChange={onPick} display={Platform.OS === "ios" ? "spinner" : "default"} />
              )}

              {/* Repetir */}
              <Text className="text-xs font-medium uppercase tracking-wide text-secondary mb-2 mt-1">Repetir</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3" contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
                {REPEAT_OPTIONS.map((o) => (
                  <Chip key={o.key} on={repeat === o.key} label={o.label} onPress={() => setRepeat(o.key)} />
                ))}
              </ScrollView>

              {/* Aviso */}
              <View className="bg-card rounded-lg2 px-4 py-3 mb-2 flex-row items-center" style={{ gap: 12 }}>
                <Ionicons name="notifications-outline" size={19} color={t.accent} />
                <Text className="flex-1 text-[15px] text-label">Avisarme a esa hora</Text>
                <Toggle value={notify} onChange={setNotify} />
              </View>
            </>
          )}

          {task && (
            <Pressable onPress={remove} className="mt-4 items-center py-2">
              <Text className="text-[14px]" style={{ color: t.red }}>Borrar tarea</Text>
            </Pressable>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function Chip({ on, label, avatar, onPress }: { on: boolean; label: string; avatar?: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center rounded-pill px-3 py-2"
      style={{ gap: 6, backgroundColor: on ? t.accent : t.fill }}
    >
      {avatar && <Avatar name={label} size={18} />}
      <Text className="text-[13px] font-medium" style={{ color: on ? "#fff" : t.label }}>{label}</Text>
    </Pressable>
  );
}
