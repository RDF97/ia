import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useQueryClient } from "@tanstack/react-query";
import { Screen } from "@/components/Screen";
import { PhaseCard } from "@/components/Card";
import { useHogar } from "@/lib/hogar";
import { useAuth } from "@/lib/auth";
import { appwriteConfigured } from "@/lib/appwrite";
import { useEvents } from "@/lib/useEvents";
import { addEvent, daysWithEvents, deleteEvent, eventsOfDay, hhmm, ymd, type Event } from "@/lib/events";
import { colors } from "@/theme/tokens";

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const WEEK = ["L", "M", "X", "J", "V", "S", "D"];

export default function Calendario() {
  const { active } = useHogar();
  const { user } = useAuth();

  if (!appwriteConfigured || !active) {
    return (
      <Screen title="Calendario" subtitle="Eventos del hogar">
        <PhaseCard phase="Fase 5 · Calendario">
          Eventos del hogar en tiempo real, con vista de mes y agenda. Se activa al
          configurar el backend y entrar en un hogar.
        </PhaseCard>
      </Screen>
    );
  }
  return <CalendarView hogarId={active.$id} userName={user?.name || "Yo"} />;
}

function CalendarView({ hogarId, userName }: { hogarId: string; userName: string }) {
  const qc = useQueryClient();
  const { data: events, isLoading } = useEvents(hogarId);
  const today = new Date();
  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [selected, setSelected] = useState(new Date());
  const [addOpen, setAddOpen] = useState(false);

  const list = events ?? [];
  const marked = useMemo(() => daysWithEvents(list), [list]);
  const dayEvents = useMemo(() => eventsOfDay(list, selected), [list, selected]);

  const cells = useMemo(() => {
    const first = new Date(view.y, view.m, 1);
    const startIdx = (first.getDay() + 6) % 7; // lunes = 0
    const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
    const arr: (number | null)[] = [];
    for (let i = 0; i < startIdx; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(d);
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [view]);

  const move = (delta: number) => {
    const m = view.m + delta;
    setView({ y: view.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 });
  };

  const isSameDay = (a: Date, b: Date) => ymd(a) === ymd(b);

  const refresh = () => qc.invalidateQueries({ queryKey: ["events", hogarId] });
  const remove = (id: string) =>
    Alert.alert("Borrar evento", "¿Seguro?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Borrar", style: "destructive", onPress: async () => { await deleteEvent(id); refresh(); } },
    ]);

  return (
    <Screen title="Calendario" subtitle={upcomingLabel(list)}>
      {/* Cabecera de mes */}
      <View className="flex-row items-center justify-between px-5 pb-2">
        <Text className="text-[22px] font-bold text-black">
          {MONTHS[view.m]} {view.y}
        </Text>
        <View className="flex-row items-center" style={{ gap: 18 }}>
          <Pressable onPress={() => move(-1)} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color={colors.accent} />
          </Pressable>
          <Pressable onPress={() => { setView({ y: today.getFullYear(), m: today.getMonth() }); setSelected(new Date()); }} hitSlop={8}>
            <Ionicons name="ellipse" size={12} color={colors.accent} />
          </Pressable>
          <Pressable onPress={() => move(1)} hitSlop={8}>
            <Ionicons name="chevron-forward" size={22} color={colors.accent} />
          </Pressable>
        </View>
      </View>

      {/* Días de la semana */}
      <View className="flex-row px-3">
        {WEEK.map((w) => (
          <Text key={w} className="text-center text-[11px] font-semibold text-neutral-500" style={{ width: `${100 / 7}%` }}>
            {w}
          </Text>
        ))}
      </View>

      {/* Rejilla */}
      <View className="flex-row flex-wrap px-3 pb-2">
        {cells.map((d, i) => {
          if (d === null) return <View key={i} style={{ width: `${100 / 7}%`, height: 44 }} />;
          const date = new Date(view.y, view.m, d);
          const isToday = isSameDay(date, today);
          const isSel = isSameDay(date, selected);
          const hasEv = marked.has(ymd(date));
          return (
            <Pressable
              key={i}
              onPress={() => setSelected(date)}
              style={{ width: `${100 / 7}%`, height: 44, alignItems: "center", justifyContent: "center" }}
            >
              <View
                style={{
                  width: 34, height: 34, borderRadius: 17,
                  alignItems: "center", justifyContent: "center",
                  backgroundColor: isToday ? colors.accent : isSel ? colors.separator : "transparent",
                }}
              >
                <Text style={{ fontSize: 16, color: isToday ? "#fff" : colors.label, fontWeight: isSel || isToday ? "700" : "400" }}>
                  {d}
                </Text>
              </View>
              <View style={{ height: 5, justifyContent: "center" }}>
                {hasEv && <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: isToday ? colors.accent : colors.pink }} />}
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Agenda del día seleccionado */}
      <Text className="px-5 pt-3 pb-2 text-[15px] font-semibold text-black">
        {selected.getDate()} de {MONTHS[selected.getMonth()].toLowerCase()}
      </Text>
      {isLoading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 12 }} />
      ) : dayEvents.length === 0 ? (
        <Text className="text-center text-neutral-400 mt-4 mb-4">Sin eventos este día.</Text>
      ) : (
        <View className="bg-white rounded-lg2 mx-4 mb-3 overflow-hidden">
          {dayEvents.map((e, i) => (
            <Pressable
              key={e.$id}
              onLongPress={() => remove(e.$id)}
              className="flex-row items-center px-4 py-3"
              style={{ gap: 12, borderTopWidth: i ? 0.5 : 0, borderTopColor: colors.separator }}
            >
              <Text className="text-[14px] font-semibold text-neutral-500" style={{ width: 48 }}>
                {hhmm(e.startAt)}
              </Text>
              <View style={{ width: 3, height: 34, borderRadius: 2, backgroundColor: colors.accent }} />
              <View className="flex-1">
                <Text className="text-[15px] font-medium text-black">{e.title}</Text>
                <Text className="text-[12px] text-neutral-500 mt-0.5">
                  {e.ownerName}{e.place ? ` · ${e.place}` : ""}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}

      <Pressable
        onPress={() => setAddOpen(true)}
        className="rounded-[14px] mx-4 mt-1 py-3.5 items-center flex-row justify-center"
        style={{ backgroundColor: colors.accent, gap: 8 }}
      >
        <Ionicons name="add" size={20} color="#fff" />
        <Text className="text-white text-base font-semibold">Añadir evento</Text>
      </Pressable>

      <AddEvent
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        hogarId={hogarId}
        userName={userName}
        initialDay={selected}
        onAdded={refresh}
      />
    </Screen>
  );
}

// Subtítulo con el nº de eventos próximos
function upcomingLabel(list: Event[]): string {
  const now = new Date();
  const upcoming = list.filter((e) => new Date(e.startAt) >= new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  return `${upcoming.length} eventos próximos`;
}

function AddEvent({
  visible,
  onClose,
  hogarId,
  userName,
  initialDay,
  onAdded,
}: {
  visible: boolean;
  onClose: () => void;
  hogarId: string;
  userName: string;
  initialDay: Date;
  onAdded: () => void;
}) {
  const [title, setTitle] = useState("");
  const [place, setPlace] = useState("");
  const [when, setWhen] = useState(() => {
    const d = new Date(initialDay);
    d.setHours(12, 0, 0, 0);
    return d;
  });
  const [picker, setPicker] = useState<null | "date" | "time">(null);
  const [busy, setBusy] = useState(false);

  const onChange = (_e: DateTimePickerEvent, d?: Date) => {
    setPicker(null);
    if (d) setWhen(d);
  };

  const submit = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await addEvent(hogarId, { title: title.trim(), startAt: when.toISOString(), ownerName: userName, place: place.trim() });
      onAdded();
      setTitle(""); setPlace("");
      onClose();
    } catch (e) {
      Alert.alert("No se pudo guardar", e instanceof Error ? e.message : "Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  const dateLabel = `${when.getDate()}/${when.getMonth() + 1}/${when.getFullYear()}`;
  const timeLabel = `${String(when.getHours()).padStart(2, "0")}:${String(when.getMinutes()).padStart(2, "0")}`;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/40" onPress={onClose} />
      <View className="bg-bg-app rounded-t-[14px] absolute left-0 right-0 bottom-0 p-5" style={{ paddingBottom: 32 }}>
        <Text className="text-[17px] font-semibold mb-4">Nuevo evento</Text>
        <TextInput
          className="bg-white rounded-lg2 px-4 py-3 mb-3 text-[16px] text-black"
          placeholder="Título"
          placeholderTextColor={colors.labelSecondary}
          value={title}
          onChangeText={setTitle}
        />
        <TextInput
          className="bg-white rounded-lg2 px-4 py-3 mb-3 text-[16px] text-black"
          placeholder="Lugar (opcional)"
          placeholderTextColor={colors.labelSecondary}
          value={place}
          onChangeText={setPlace}
        />
        <View className="flex-row mb-4" style={{ gap: 8 }}>
          <Pressable onPress={() => setPicker("date")} className="flex-1 bg-white rounded-lg2 px-4 py-3 flex-row items-center" style={{ gap: 8 }}>
            <Ionicons name="calendar-outline" size={18} color={colors.accent} />
            <Text className="text-[15px] text-black">{dateLabel}</Text>
          </Pressable>
          <Pressable onPress={() => setPicker("time")} className="flex-1 bg-white rounded-lg2 px-4 py-3 flex-row items-center" style={{ gap: 8 }}>
            <Ionicons name="time-outline" size={18} color={colors.accent} />
            <Text className="text-[15px] text-black">{timeLabel}</Text>
          </Pressable>
        </View>

        {picker && (
          <DateTimePicker
            value={when}
            mode={picker}
            is24Hour
            onChange={onChange}
            display={Platform.OS === "ios" ? "spinner" : "default"}
          />
        )}

        <Pressable
          onPress={submit}
          disabled={busy}
          className="rounded-[14px] py-3.5 items-center"
          style={{ backgroundColor: colors.accent, opacity: busy ? 0.6 : 1 }}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text className="text-white text-base font-semibold">Guardar</Text>}
        </Pressable>
      </View>
    </Modal>
  );
}
