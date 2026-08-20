import type { ReactNode } from "react";
import { Pressable, Text, View, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { cardShadow } from "./Card";
import { useTheme } from "@/theme/theme";
import { Metrics } from "@/theme/type";
import { hSelect } from "@/lib/haptics";
import type { IoniconName } from "./ui";

/**
 * Lista agrupada al estilo de iOS ("inset grouped").
 *
 * Antes cada pantalla se dibujaba sus filas a mano, y de ahí venían dos cosas
 * que se notan aunque no se sepan nombrar:
 *
 *  · los separadores iban de borde a borde, y en iOS empiezan alineados con el
 *    texto, no con el borde de la tarjeta. Esa sangría es lo que hace que una
 *    lista parezca del sistema;
 *  · cada fila tenía su propio alto y su propio relleno, así que la vista se
 *    veía irregular al recorrerla.
 *
 * `ListGroup` pone la tarjeta y `Row` las filas, con 44 pt de alto mínimo (el
 * mínimo táctil del HIG) y respuesta al pulsar.
 */
export function ListGroup({
  children,
  style,
  inset = true,
}: {
  children: ReactNode;
  style?: ViewStyle;
  /** Márgenes laterales de 16 pt. Desactívalo si ya vas dentro de una tarjeta. */
  inset?: boolean;
}) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: t.card,
          borderRadius: Metrics.radiusCard - 2,
          overflow: "hidden",
          marginHorizontal: inset ? Metrics.margin : 0,
          marginBottom: inset ? 12 : 0,
        },
        cardShadow(t.dark),
        style,
      ]}
    >
      {children}
    </View>
  );
}

/**
 * Fila de lista. `leading` es lo que va a la izquierda (icono, avatar, check);
 * la sangría del separador se calcula a partir de su ancho, como en iOS.
 */
export function Row({
  first,
  leading,
  leadingWidth = Metrics.rowIcon,
  title,
  subtitle,
  trailing,
  chevron,
  onPress,
  destructive,
  separatorInset,
  children,
}: {
  first?: boolean;
  leading?: ReactNode;
  /** Ancho de `leading`, para sangrar el separador igual que iOS. */
  leadingWidth?: number;
  title?: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  chevron?: boolean;
  onPress?: () => void;
  destructive?: boolean;
  /** Sangría manual del separador; por defecto se deduce de `leading`. */
  separatorInset?: number;
  /** Contenido a medida en vez de título/subtítulo. */
  children?: ReactNode;
}) {
  const t = useTheme();
  const gap = 12;
  const inset = separatorInset ?? (leading ? Metrics.margin + leadingWidth + gap : Metrics.margin);

  const body = (
    <View
      className="flex-row items-center"
      style={{
        gap,
        minHeight: Metrics.rowMinHeight,
        paddingHorizontal: Metrics.margin,
        paddingVertical: 10,
      }}
    >
      {leading}
      <View className="flex-1">
        {children ?? (
          <>
            {typeof title === "string" ? (
              <Text className="text-body" style={{ color: destructive ? t.red : t.label }} numberOfLines={1}>
                {title}
              </Text>
            ) : (
              title
            )}
            {typeof subtitle === "string" ? (
              <Text className="text-footnote text-secondary mt-0.5" numberOfLines={1}>
                {subtitle}
              </Text>
            ) : (
              subtitle
            )}
          </>
        )}
      </View>
      {trailing}
      {chevron && <Ionicons name="chevron-forward" size={16} color={t.tabInactive} />}
    </View>
  );

  return (
    <View>
      {!first && (
        <View style={{ height: 0.5, backgroundColor: t.separator, marginLeft: inset }} />
      )}
      {onPress ? (
        <Pressable
          onPress={() => {
            hSelect();
            onPress();
          }}
          style={({ pressed }) => ({ backgroundColor: pressed ? t.fill : "transparent" })}
        >
          {body}
        </Pressable>
      ) : (
        body
      )}
    </View>
  );
}

/** Icono cuadrado de fila, como los de Ajustes de iOS. */
export function RowIcon({ icon, color, size = Metrics.rowIcon }: { icon: IoniconName; color: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.25,
        backgroundColor: color,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name={icon} size={size * 0.56} color="#fff" />
    </View>
  );
}
