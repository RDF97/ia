import type { TextStyle } from "react-native";

/**
 * Escala tipográfica de Apple (HIG · iOS, tamaños por defecto de Dynamic Type).
 *
 * Los tamaños NO son libres: Apple define una escala concreta y cada estilo
 * tiene su interlineado y su tracking. Usar valores intermedios (14, 18…) es lo
 * que hace que una interfaz "cante" aunque no sepas por qué.
 *
 * Referencia (tamaño / interlineado):
 *   Large Title 34/41 · Title1 28/34 · Title2 22/28 · Title3 20/25
 *   Headline 17/22 (semibold) · Body 17/22 · Callout 16/21 · Subhead 15/20
 *   Footnote 13/18 · Caption1 12/16 · Caption2 11/13
 */
export const Type = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: "700", letterSpacing: 0.37 },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: "700", letterSpacing: 0.36 },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: "700", letterSpacing: 0.35 },
  title3: { fontSize: 20, lineHeight: 25, fontWeight: "600", letterSpacing: 0.38 },
  /** Título de una fila o tarjeta. */
  headline: { fontSize: 17, lineHeight: 22, fontWeight: "600", letterSpacing: -0.41 },
  /** Texto principal: el de las filas de lista. */
  body: { fontSize: 17, lineHeight: 22, fontWeight: "400", letterSpacing: -0.41 },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: "400", letterSpacing: -0.32 },
  /** Texto secundario destacado. */
  subhead: { fontSize: 15, lineHeight: 20, fontWeight: "400", letterSpacing: -0.24 },
  /** Subtítulos de fila y cabeceras de sección en mayúsculas. */
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: "400", letterSpacing: -0.08 },
  caption1: { fontSize: 12, lineHeight: 16, fontWeight: "400", letterSpacing: 0 },
  caption2: { fontSize: 11, lineHeight: 13, fontWeight: "400", letterSpacing: 0.07 },
} satisfies Record<string, TextStyle>;

/**
 * Métricas de Apple para el trazado.
 * - `tap`: 44×44 pt es el mínimo táctil del HIG. Por debajo, la gente falla.
 * - `margin`: 16 pt de margen lateral estándar.
 * - `rowMinHeight`: 44 pt de alto mínimo de fila de lista.
 */
export const Metrics = {
  tap: 44,
  margin: 16,
  rowMinHeight: 44,
  /** Icono cuadrado de fila, estilo Ajustes de iOS. */
  rowIcon: 29,
  /** Radios: tarjetas grandes y controles. */
  radiusCard: 16,
  radiusControl: 10,
} as const;

/** Números tabulares para importes (que no “bailen” al cambiar de cifra). */
export const tabular: TextStyle = { fontVariant: ["tabular-nums"] };
