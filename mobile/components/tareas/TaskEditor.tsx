import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useTheme } from "@/theme/theme";
import { SheetHeader } from "@/components/SheetHeader";
import { useKeyboardHeight } from "@/lib/useKeyboard";
import { Toggle } from "@/components/Toggle";
import { Avatar, AvatarStack } from "@/components/ui";
import { REPEAT_OPTIONS, type Repeat } from "@/lib/taskLogic";
import { DEFAULT_LEAD, LEAD_OPTIONS, normalizeLead } from "@/lib/leadTime";
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
  const kb = useKeyboardHeight();
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
  // Antelación del aviso, por tarea (los eventos la tienen global).
  const [lead, setLead] = useState<number>(DEFAULT_LEAD);
  const [picker, setPicker] = useState<null | "date" | "time" | "until">(null);
  const [busy, setBusy] = useState(false);
  // Fecha límite de la repetición (p. ej. el ING se repite cada mes hasta septiembre).
  const [hasUntil, setHasUntil] = useState(false);
  const [until, setUntil] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 3);
    return d;
  });

  useEffect(() => {
    if (!target) return;
    if (task) {
      setTitle(task.title);
      setAssigned(task.assignedToName ?? null);
      setRepeat(task.repeat ?? "none");
      setNotify(task.notify ?? false);
      setLead(normalizeLead(task.notifyLead));
      if (task.dueAt) {
        setHasDate(true);
        setWhen(new Date(task.dueAt));
      } else {
        setHasDate(false);
      }
      if (task.repeatUntil) {
        setHasUntil(true);
        setUntil(new Date(task.repeatUntil));
      } else {
        setHasUntil(false);
      }
    } else {
      setTitle("");
      setAssigned(null);
      setRepeat("none");
      setNotify(false);
      setLead(DEFAULT_LEAD);
      setHasDate(false);
      setHasUntil(false);
      const d = new Date();
      d.setHours(d.getHours() + 1, 0, 0, 0);
      setWhen(d);
    }
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPick = (_e: DateTimePickerEvent, d?: Date) => {
    const mode = picker;
    setPicker(null);
    if (!d) return;
    if (mode === "until") setUntil(d);
    else setWhen(d);
  };

  const memberList = [...new Set([userName, ...members].filter((n) => n && n.trim()))];

  const save = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      if (notify && hasDate) await ensureNotificationPermissions();
      const dueAt = hasDate ? when.toISOString() : null;
      const repeats = hasDate && repeat !== "none";
      const payload = {
        title: title.trim(),
        assignedToName: assigned,
        dueAt,
        repeat: hasDate ? repeat : "none",
        repeatUntil: repeats && hasUntil ? until.toISOString() : null,
        notify: hasDate ? notify : false,
        notifyLead: hasDate && notify ? lead : DEFAULT_LEAD,
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
  const untilLabel = `${until.getDate()}/${until.getMonth() + 1}/${until.getFullYear()}`;

  return (
    <Modal visible={target !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1" style={{ backgroundColor: t.overlay }} onPress={onClose} />
      <View
        className="rounded-t-sheet absolute left-0 right-0 bottom-0"
        style={{ maxHeight: "90%", paddingBottom: kb, backgroundColor: t.bg }}
      >
        <SheetHeader
          title={isNew ? "Nueva tarea" : "Editar tarea"}
          onClose={onClose}
          onSave={save}
          dirty={title.trim().length > 0}
          saving={busy}
          saveDisabled={!title.trim()}
        />

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }}>
          <TextInput
            className="bg-card rounded-lg2 px-4 py-3 mb-4 text-callout text-label"
            placeholder="¿Qué hay que hacer?"
            placeholderTextColor={t.labelTertiary}
            value={title}
            onChangeText={setTitle}
            autoCapitalize="sentences"
          />

          {/* Asignar. Sin asignar = tarea de todos, no "de nadie". */}
          <Text className="text-caption1 font-medium uppercase tracking-wide text-secondary mb-2">Asignar a</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4" contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
            <Pressable
              onPress={() => setAssigned(null)}
              className="flex-row items-center rounded-pill px-3 py-2"
              style={{ gap: 6, backgroundColor: assigned === null ? t.accent : t.fill }}
            >
              <AvatarStack names={memberList} size={18} />
              <Text className="text-footnote font-medium" style={{ color: assigned === null ? "#fff" : t.label }}>
                Todos
              </Text>
            </Pressable>
            {memberList.map((m) => (
              <Chip key={m} on={assigned === m} label={m} avatar onPress={() => setAssigned(m)} />
            ))}
          </ScrollView>
          {memberList.length === 1 && (
            // Salir solo tú parece un fallo de la app, y en la práctica lo era:
            // Appwrite no nos da el nombre de los demás. Decir dónde se arregla
            // evita la búsqueda a ciegas por los ajustes.
            <Text className="text-caption1 text-tertiary px-4 pb-2">
              ¿Falta alguien? Ponle nombre en Perfil › Tu hogar y aparecerá aquí.
            </Text>
          )}

          {/* Fecha */}
          <View className="bg-card rounded-lg2 px-4 py-3 mb-3 flex-row items-center" style={{ gap: 12 }}>
            <Ionicons name="calendar-outline" size={19} color={t.accent} />
            <Text className="flex-1 text-subhead text-label">Fecha y hora</Text>
            <Toggle value={hasDate} onChange={setHasDate} />
          </View>

          {hasDate && (
            <>
              <View className="flex-row mb-3" style={{ gap: 8 }}>
                <Pressable onPress={() => setPicker("date")} className="flex-1 bg-card rounded-lg2 px-4 py-3 flex-row items-center justify-center" style={{ gap: 8 }}>
                  <Ionicons name="calendar-outline" size={17} color={t.accent} />
                  <Text className="text-subhead text-label">{dateLabel}</Text>
                </Pressable>
                <Pressable onPress={() => setPicker("time")} className="flex-1 bg-card rounded-lg2 px-4 py-3 flex-row items-center justify-center" style={{ gap: 8 }}>
                  <Ionicons name="time-outline" size={17} color={t.accent} />
                  <Text className="text-subhead text-label">{timeLabel}</Text>
                </Pressable>
              </View>

              {picker && (
                <DateTimePicker
                  value={picker === "until" ? until : when}
                  mode={picker === "until" ? "date" : picker}
                  is24Hour
                  onChange={onPick}
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                />
              )}

              {/* Repetir */}
              <Text className="text-caption1 font-medium uppercase tracking-wide text-secondary mb-2 mt-1">Repetir</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3" contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
                {REPEAT_OPTIONS.map((o) => (
                  <Chip key={o.key} on={repeat === o.key} label={o.label} onPress={() => setRepeat(o.key)} />
                ))}
              </ScrollView>

              {/* Hasta cuándo se repite (p. ej. el recibo del ING, hasta septiembre) */}
              {repeat !== "none" && (
                <>
                  <View className="bg-card rounded-lg2 px-4 py-3 mb-3 flex-row items-center" style={{ gap: 12 }}>
                    <Ionicons name="flag-outline" size={19} color={t.accent} />
                    <Text className="flex-1 text-subhead text-label">Terminar en una fecha</Text>
                    <Toggle value={hasUntil} onChange={setHasUntil} />
                  </View>
                  {hasUntil && (
                    <Pressable
                      onPress={() => setPicker("until")}
                      className="bg-card rounded-lg2 px-4 py-3 mb-3 flex-row items-center"
                      style={{ gap: 8 }}
                    >
                      <Ionicons name="calendar-outline" size={17} color={t.accent} />
                      <Text className="flex-1 text-subhead text-label">Último día</Text>
                      <Text className="text-subhead text-secondary">{untilLabel}</Text>
                    </Pressable>
                  )}
                </>
              )}

              {/* Aviso */}
              <View className="bg-card rounded-lg2 px-4 py-3 mb-2 flex-row items-center" style={{ gap: 12 }}>
                <Ionicons name="notifications-outline" size={19} color={t.accent} />
                <Text className="flex-1 text-subhead text-label">Avisarme</Text>
                <Toggle value={notify} onChange={setNotify} />
              </View>

              {notify && (
                <>
                  <Text className="text-caption1 font-medium uppercase tracking-wide text-secondary mb-2 mt-1">
                    Con cuánta antelación
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    className="mb-2"
                    contentContainerStyle={{ gap: 8, paddingRight: 8 }}
                  >
                    {LEAD_OPTIONS.map((o) => (
                      <Chip key={o.key} on={lead === o.key} label={o.label} onPress={() => setLead(o.key)} />
                    ))}
                  </ScrollView>
                </>
              )}
            </>
          )}

          {task && (
            <Pressable onPress={remove} className="mt-4 items-center py-2">
              <Text className="text-subhead" style={{ color: t.red }}>Borrar tarea</Text>
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
      <Text className="text-footnote font-medium" style={{ color: on ? "#fff" : t.label }}>{label}</Text>
    </Pressable>
  );
}
