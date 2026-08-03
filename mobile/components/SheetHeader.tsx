import { Alert, Pressable, Text, View } from "react-native";
import { useTheme } from "@/theme/theme";

/**
 * Cabecera de las hojas modales: "Cerrar" a la izquierda y "Guardar" a la derecha.
 *
 * Cerrar sale sin guardar; solo avisa si hay cambios sin guardar (`dirty`), para
 * no molestar cuando solo estabas mirando.
 */
export function SheetHeader({
  title,
  onClose,
  onSave,
  saveLabel = "Guardar",
  closeLabel = "Cerrar",
  dirty = false,
  saving = false,
  saveDisabled = false,
}: {
  title: string;
  onClose: () => void;
  /** Si no se pasa, la hoja no tiene acción de guardar (solo se cierra). */
  onSave?: () => void;
  saveLabel?: string;
  closeLabel?: string;
  /** Hay cambios sin guardar → al cerrar se pide confirmación. */
  dirty?: boolean;
  saving?: boolean;
  saveDisabled?: boolean;
}) {
  const t = useTheme();

  const close = () => {
    if (!dirty) {
      onClose();
      return;
    }
    Alert.alert("Descartar cambios", "Has hecho cambios sin guardar. ¿Salir igualmente?", [
      { text: "Seguir editando", style: "cancel" },
      { text: "Descartar", style: "destructive", onPress: onClose },
    ]);
  };

  return (
    <View
      className="flex-row items-center justify-between px-5 py-3"
      style={{ borderBottomWidth: 0.5, borderBottomColor: t.separator }}
    >
      <Pressable onPress={close} hitSlop={8} style={{ minWidth: 64 }}>
        <Text className="text-base" style={{ color: t.accent }}>{closeLabel}</Text>
      </Pressable>

      <Text className="text-headline font-semibold text-label" numberOfLines={1} style={{ flex: 1, textAlign: "center" }}>
        {title}
      </Text>

      {onSave ? (
        <Pressable
          onPress={onSave}
          disabled={saving || saveDisabled}
          hitSlop={8}
          style={{ minWidth: 64, alignItems: "flex-end", opacity: saving || saveDisabled ? 0.4 : 1 }}
        >
          <Text className="text-base font-semibold" style={{ color: t.accent }}>{saveLabel}</Text>
        </Pressable>
      ) : (
        <View style={{ minWidth: 64 }} />
      )}
    </View>
  );
}
