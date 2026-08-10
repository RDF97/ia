import type { RefObject } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/theme/theme";
import { hSelect } from "@/lib/haptics";
import type { IoniconName } from "./ui";

/**
 * Barra flotante para añadir, anclada sobre la barra de pestañas (va dentro de
 * `Screen floating`). Es la misma que se usa en Compra.
 *
 * Todo el estilo va en un View normal con estilo fijo: no usamos className ni
 * estilos en función porque con NativeWind se descartaban y el control acababa
 * sin tamaño ni posición (invisible).
 *
 * Dos modos:
 *  - escritura: se le pasa `value`/`onChange`/`onSubmit` (p. ej. añadir tarea).
 *  - botón: solo `onPress`; la barra entera abre un formulario (p. ej. gasto).
 */
export function AddBar({
  placeholder,
  value,
  onChange,
  onSubmit,
  onPress,
  busy = false,
  actionIcon = "add",
  leadingIcon = "add",
  onAction,
  inputRef,
}: {
  placeholder: string;
  value?: string;
  onChange?: (v: string) => void;
  onSubmit?: () => void;
  /** Modo botón: al pulsar la barra se ejecuta esto (no hay campo de texto). */
  onPress?: () => void;
  busy?: boolean;
  /** Icono del botón redondo cuando no hay texto escrito. */
  actionIcon?: IoniconName;
  /** Icono decorativo de la izquierda; cámbialo si el redondo ya es un "+". */
  leadingIcon?: IoniconName;
  /** Acción del botón redondo cuando no hay texto (p. ej. abrir el formulario completo). */
  onAction?: () => void;
  inputRef?: RefObject<TextInput | null>;
}) {
  const t = useTheme();
  const hasText = (value ?? "").trim().length > 0;

  const container = {
    position: "absolute" as const,
    left: 16,
    right: 16,
    bottom: 16,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    borderRadius: 999,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
    gap: 10,
    backgroundColor: t.card,
    borderWidth: 0.5,
    borderColor: t.separator,
    shadowColor: "#000",
    shadowOpacity: t.dark ? 0.3 : 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  };

  const roundBtn = {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: t.accent,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  };

  // Modo botón: la barra entera es pulsable.
  if (onPress) {
    return (
      <Pressable
        onPress={() => {
          hSelect();
          onPress();
        }}
        style={container}
      >
        <Ionicons name={leadingIcon} size={20} color={t.labelTertiary} />
        <Text style={{ flex: 1, fontSize: 15, color: t.labelTertiary }}>{placeholder}</Text>
        <View style={roundBtn}>
          {busy ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name={actionIcon} size={16} color="#fff" />}
        </View>
      </Pressable>
    );
  }

  return (
    <View style={container}>
      <Ionicons name={leadingIcon} size={20} color={t.labelTertiary} />
      <TextInput
        ref={inputRef}
        style={{ flex: 1, fontSize: 15, color: t.label, paddingVertical: 6 }}
        placeholder={placeholder}
        placeholderTextColor={t.labelTertiary}
        value={value}
        onChangeText={onChange}
        onSubmitEditing={onSubmit}
        returnKeyType="done"
        blurOnSubmit={false}
      />
      <Pressable
        onPress={() => {
          hSelect();
          if (hasText) onSubmit?.();
          else onAction?.();
        }}
        style={roundBtn}
      >
        {busy ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Ionicons name={hasText ? "arrow-up" : actionIcon} size={16} color="#fff" />
        )}
      </Pressable>
    </View>
  );
}
