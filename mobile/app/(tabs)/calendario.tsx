import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
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
import { addEvent, dayIndexLabel, daysWithEvents, deleteEvent, eventsOfDay, hhmm, ymd, type Event } from "@/lib/events";
import { SwipeToDelete } from "@/components/SwipeToDelete";
import { SheetHeader } from "@/components/SheetHeader";
import { Segmented } from "@/components/Segmented";
import { Toggle } from "@/components/Toggle";
import {
  addToGoogleCalendar,
  getLeadMinutes,
  setLeadMinutes,
  syncEventReminders,
  LEAD_OPTIONS,
} from "@/lib/eventReminders";
import { ensureNotificationPermissions } from "@/lib/notifications";
import { cardShadow } from "@/components/Card";
import { useTheme } from "@/theme/theme";
import { useKeyboardHeight } from "@/lib/useKeyboard";

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
  const t = useTheme();
  const qc = useQueryClient();
  const { data: events, isLoading } = useEvents(hogarId);
  const today = new Date();
  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [selected, setSelected] = useState(new Date());
  const [addOpen, setAddOpen] = useState(false);
  const [lead, setLead] = useState(15);
  const [leadOpen, setLeadOpen] = useState(false);

  useEffect(() => {
    getLeadMinutes().then(setLead).catch(() => undefined);
  }, []);

  // Programa/actualiza los avisos locales de los eventos.
  useEffect(() => {
    if (events) syncEventReminders(events, lead).catch(() => undefined);
  }, [events, lead]);

  const changeLead = async (min: number) => {
    setLead(min);
    await setLeadMinutes(min).catch(() => undefined);
    if (min >= 0) await ensureNotificationPermissions().catch(() => undefined);
  };

  const list = events ?? [];
  const marked = useMemo(() => daysWithEvents(list), [list]);
  const dayEvents = useMemo(() => eventsOfDay(list, selected), [list, selected]);

  // La rejilla se arma en FILAS de 7. Antes era una sola lista con `flex-wrap` y
  // celdas al 100/7 %: por redondeo de píxeles la séptima columna se iba a la
  // línea siguiente en algunas pantallas y los domingos desaparecían.
  const weeks = useMemo(() => {
    const first = new Date(view.y, view.m, 1);
    const startIdx = (first.getDay() + 6) % 7; // lunes = 0
    const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
    const arr: (number | null)[] = [];
    for (let i = 0; i < startIdx; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(d);
    while (arr.length % 7 !== 0) arr.push(null);
    const rows: (number | null)[][] = [];
    for (let i = 0; i < arr.length; i += 7) rows.push(arr.slice(i, i + 7));
    return rows;
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
      {
        text: "Borrar",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteEvent(id);
            refresh();
          } catch (e) {
            Alert.alert("No se pudo borrar", e instanceof Error ? e.message : "Inténtalo de nuevo.");
          }
        },
      },
    ]);

  return (
    <Screen title="Calendario" subtitle={upcomingLabel(list)} onRefresh={refresh}>
      {/* Cabecera de mes */}
      <View className="flex-row items-center justify-between px-4 pb-2">
        <Text className="text-title2 font-bold text-label">
          {MONTHS[view.m]} {view.y}
        </Text>
        <View className="flex-row items-center" style={{ gap: 18 }}>
          <Pressable onPress={() => setLeadOpen(true)} hitSlop={8}>
            <Ionicons name="notifications-outline" size={20} color={t.accent} />
          </Pressable>
          <Pressable onPress={() => move(-1)} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color={t.accent} />
          </Pressable>
          <Pressable onPress={() => { setView({ y: today.getFullYear(), m: today.getMonth() }); setSelected(new Date()); }} hitSlop={8}>
            <Ionicons name="ellipse" size={12} color={t.accent} />
          </Pressable>
          <Pressable onPress={() => move(1)} hitSlop={8}>
            <Ionicons name="chevron-forward" size={22} color={t.accent} />
          </Pressable>
        </View>
      </View>

      {/* Días de la semana */}
      <View className="flex-row px-3">
        {WEEK.map((w, i) => (
          <Text key={`${w}-${i}`} className="text-center text-caption2 font-semibold text-secondary" style={{ flex: 1 }}>
            {w}
          </Text>
        ))}
      </View>

      {/* Rejilla, fila a fila (7 celdas con flex: 1 → el domingo siempre cabe) */}
      <View className="px-3 pb-2">
        {weeks.map((week, r) => (
          <View key={r} className="flex-row">
            {week.map((d, i) => {
              if (d === null) return <View key={i} style={{ flex: 1, height: 46 }} />;
              const date = new Date(view.y, view.m, d);
              const isToday = isSameDay(date, today);
              const isSel = isSameDay(date, selected);
              const hasEv = marked.has(ymd(date));
              return (
                <Pressable
                  key={i}
                  onPress={() => setSelected(date)}
                  style={{ flex: 1, height: 46, alignItems: "center", justifyContent: "center" }}
                >
                  <View
                    style={{
                      width: 34, height: 34, borderRadius: 17,
                      alignItems: "center", justifyContent: "center",
                      backgroundColor: isSel ? t.accent : isToday ? t.accentSoft : "transparent",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 16,
                        color: isSel ? "#fff" : isToday ? t.accent : t.label,
                        fontWeight: isSel || isToday ? "700" : "400",
                      }}
                    >
                      {d}
                    </Text>
                  </View>
                  <View style={{ height: 6, justifyContent: "center" }}>
                    {hasEv && (
                      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: isSel ? t.accent : t.pink }} />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator color={t.accent} style={{ marginTop: 12 }} />
      ) : dayEvents.length === 0 ? (
        <Text className="text-center text-tertiary mt-4 mb-4">Sin eventos este día.</Text>
      ) : (
        <View className="bg-card rounded-lg2 mx-4 mb-3 overflow-hidden" style={cardShadow(t.dark)}>
          {dayEvents.map((e, i) => (
            <SwipeToDelete key={e.$id} onDelete={() => remove(e.$id)}>
              <View
                className="flex-row items-center px-4 py-3"
                style={{ gap: 12, borderTopWidth: i ? 0.5 : 0, borderTopColor: t.separator }}
              >
                <Text
                  className="text-subhead font-semibold text-secondary"
                  style={{ width: 48, fontVariant: ["tabular-nums"] }}
                >
                  {e.allDay ? "Todo\nel día" : hhmm(e.startAt)}
                </Text>
                <View style={{ width: 3, height: 34, borderRadius: 2, backgroundColor: t.accent }} />
                <View className="flex-1">
                  <Text className="text-body text-label">{e.title}</Text>
                  <Text className="text-caption1 text-secondary mt-0.5">
                    {[dayIndexLabel(e, selected), e.ownerName, e.place].filter(Boolean).join(" · ")}
                  </Text>
                </View>
                <Pressable
                  onPress={() => addToGoogleCalendar(e).catch(() => undefined)}
                  hitSlop={8}
                  className="rounded-pill items-center justify-center"
                  style={{ width: 44, height: 44, backgroundColor: t.fill }}
                >
                  <Ionicons name="logo-google" size={15} color={t.accent} />
                </Pressable>
              </View>
            </SwipeToDelete>
          ))}
        </View>
      )}

      <Pressable
        onPress={() => setAddOpen(true)}
        className="rounded-[14px] mx-4 mt-1 py-3.5 items-center flex-row justify-center"
        style={{ backgroundColor: t.accent, gap: 8 }}
      >
        <Ionicons name="add" size={20} color="#fff" />
        <Text className="text-white text-base font-semibold">Añadir evento</Text>
      </Pressable>

      <Text className="px-4 pt-3 pb-2 text-caption1 text-tertiary">
        Desliza un evento para borrarlo; el botón de Google lo añade a tu Google Calendar.
      </Text>

      {/* Los minutos de aviso son un ajuste, no algo que mirar cada día: viven
          detrás de la campana de la cabecera, no debajo del calendario. */}
      <Modal visible={leadOpen} transparent animationType="slide" onRequestClose={() => setLeadOpen(false)}>
        <Pressable className="flex-1" style={{ backgroundColor: t.overlay }} onPress={() => setLeadOpen(false)} />
        <View className="rounded-t-[14px] absolute left-0 right-0 bottom-0" style={{ paddingBottom: 32, backgroundColor: t.bg }}>
          <SheetHeader title="Avisos" onClose={() => setLeadOpen(false)} closeLabel="Listo" />
          <View className="pt-3 pb-1">
            <Segmented
              value={String(lead)}
              onChange={(k) => changeLead(parseInt(k, 10))}
              options={LEAD_OPTIONS.map((o) => ({ key: String(o.key), label: o.label }))}
            />
            <Text className="px-4 pt-2 text-caption1 text-tertiary">
              Con cuánta antelación te avisa este móvil antes de cada evento.
            </Text>
          </View>
        </View>
      </Modal>

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
  const t = useTheme();
  const kb = useKeyboardHeight();
  const [title, setTitle] = useState("");
  const [place, setPlace] = useState("");
  const [when, setWhen] = useState(() => atNoon(initialDay));
  const [allDay, setAllDay] = useState(false);
  const [multi, setMulti] = useState(false);
  const [endsAt, setEndsAt] = useState(() => atNoon(initialDay));
  const [picker, setPicker] = useState<null | "date" | "time" | "end">(null);
  const [busy, setBusy] = useState(false);

  // Al abrir, el formulario arranca en el día que has tocado en el calendario.
  // Antes la fecha se fijaba en el primer render y se quedaba pegada al día en
  // que abriste la app por primera vez.
  useEffect(() => {
    if (!visible) return;
    setWhen(atNoon(initialDay));
    setEndsAt(atNoon(initialDay));
    setTitle("");
    setPlace("");
    setAllDay(false);
    setMulti(false);
    setPicker(null);
  }, [visible, initialDay]);

  const onChange = (_e: DateTimePickerEvent, d?: Date) => {
    const mode = picker;
    setPicker(null);
    if (!d) return;
    if (mode === "end") {
      setEndsAt(d);
      return;
    }
    setWhen(d);
    // Un evento no puede acabar antes de empezar: arrastramos el fin.
    if (d.getTime() > endsAt.getTime()) setEndsAt(d);
  };

  const submit = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const start = allDay ? startOfDay(when) : when;
      await addEvent(hogarId, {
        title: title.trim(),
        startAt: start.toISOString(),
        ownerName: userName,
        place: place.trim(),
        endAt: multi ? endOfDay(endsAt).toISOString() : allDay ? endOfDay(when).toISOString() : null,
        allDay,
      });
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
  const endLabel = `${endsAt.getDate()}/${endsAt.getMonth() + 1}/${endsAt.getFullYear()}`;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1" style={{ backgroundColor: t.overlay }} onPress={onClose} />
      <View className="rounded-t-[14px] absolute left-0 right-0 bottom-0" style={{ paddingBottom: 32 + kb, backgroundColor: t.bg }}>
        <SheetHeader
          title="Nuevo evento"
          onClose={onClose}
          onSave={submit}
          dirty={title.trim().length > 0 || place.trim().length > 0}
          saving={busy}
          saveDisabled={!title.trim()}
        />
        <ScrollView contentContainerStyle={{ padding: 20 }}>
        <TextInput
          className="bg-card rounded-lg2 px-4 py-3 mb-3 text-callout text-label"
          placeholder="Título"
          placeholderTextColor={t.labelTertiary}
          value={title}
          onChangeText={setTitle}
        />
        <TextInput
          className="bg-card rounded-lg2 px-4 py-3 mb-3 text-callout text-label"
          placeholder="Lugar (opcional)"
          placeholderTextColor={t.labelTertiary}
          value={place}
          onChangeText={setPlace}
        />
        <View className="flex-row mb-3" style={{ gap: 8 }}>
          <Pressable onPress={() => setPicker("date")} className="flex-1 bg-card rounded-lg2 px-4 py-3 flex-row items-center" style={{ gap: 8 }}>
            <Ionicons name="calendar-outline" size={18} color={t.accent} />
            <Text className="text-subhead text-label">{dateLabel}</Text>
          </Pressable>
          {!allDay && (
            <Pressable onPress={() => setPicker("time")} className="flex-1 bg-card rounded-lg2 px-4 py-3 flex-row items-center" style={{ gap: 8 }}>
              <Ionicons name="time-outline" size={18} color={t.accent} />
              <Text className="text-subhead text-label">{timeLabel}</Text>
            </Pressable>
          )}
        </View>

        <View className="bg-card rounded-lg2 px-4 py-3 mb-3 flex-row items-center" style={{ gap: 12 }}>
          <Ionicons name="sunny-outline" size={19} color={t.accent} />
          <Text className="flex-1 text-subhead text-label">Todo el día</Text>
          <Toggle value={allDay} onChange={setAllDay} />
        </View>

        {/* Varios días: vacaciones, un viaje, una visita larga… */}
        <View className="bg-card rounded-lg2 px-4 py-3 mb-3 flex-row items-center" style={{ gap: 12 }}>
          <Ionicons name="albums-outline" size={19} color={t.accent} />
          <Text className="flex-1 text-subhead text-label">Dura varios días</Text>
          <Toggle value={multi} onChange={setMulti} />
        </View>

        {multi && (
          <Pressable
            onPress={() => setPicker("end")}
            className="bg-card rounded-lg2 px-4 py-3 mb-3 flex-row items-center"
            style={{ gap: 8 }}
          >
            <Ionicons name="flag-outline" size={18} color={t.accent} />
            <Text className="flex-1 text-subhead text-label">Último día</Text>
            <Text className="text-subhead text-secondary">{endLabel}</Text>
          </Pressable>
        )}

        {picker && (
          <DateTimePicker
            value={picker === "end" ? endsAt : when}
            mode={picker === "time" ? "time" : "date"}
            minimumDate={picker === "end" ? when : undefined}
            is24Hour
            onChange={onChange}
            display={Platform.OS === "ios" ? "spinner" : "default"}
          />
        )}

        </ScrollView>
      </View>
    </Modal>
  );
}

const atNoon = (d: Date): Date => {
  const out = new Date(d);
  out.setHours(12, 0, 0, 0);
  return out;
};
const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
const endOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 0, 0);
