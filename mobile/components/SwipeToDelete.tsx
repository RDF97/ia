import { useRef, type ReactNode } from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { RectButton, Swipeable } from "react-native-gesture-handler";
import { useTheme } from "@/theme/theme";
import { hSelect } from "@/lib/haptics";

/**
 * Fila que se desliza hacia la izquierda para borrar (estilo Gmail).
 * Al soltar se cierra sola: la confirmación la pone quien lo usa (Alert).
 */
export function SwipeToDelete({
  children,
  onDelete,
  label = "Borrar",
  enabled = true,
}: {
  children: ReactNode;
  onDelete: () => void;
  label?: string;
  enabled?: boolean;
}) {
  const t = useTheme();
  const ref = useRef<Swipeable>(null);

  if (!enabled) return <>{children}</>;

  return (
    <Swipeable
      ref={ref}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={() => (
        <RectButton
          onPress={() => {
            hSelect();
            ref.current?.close();
            onDelete();
          }}
          style={{
            backgroundColor: t.red,
            justifyContent: "center",
            alignItems: "center",
            width: 88,
          }}
        >
          <View style={{ alignItems: "center", gap: 2 }}>
            <Ionicons name="trash-outline" size={20} color="#fff" />
            <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>{label}</Text>
          </View>
        </RectButton>
      )}
    >
      {/* El fondo evita que se transparente la fila al deslizar. */}
      <View style={{ backgroundColor: t.card }}>{children}</View>
    </Swipeable>
  );
}
