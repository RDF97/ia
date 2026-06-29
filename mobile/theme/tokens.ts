// Tokens del design system Homie (alineados con el mockup Apple HIG).
export const colors = {
  accent: "#1F4D52",
  accentDark: "#3FA5AD",
  blue: "#007AFF",
  green: "#34C759",
  orange: "#FF9500",
  red: "#FF3B30",
  yellow: "#FFCC00",
  teal: "#5AC8FA",
  purple: "#AF52DE",
  pink: "#FF2D55",
  bgApp: "#F2F2F7",
  label: "#000000",
  labelSecondary: "rgba(60,60,67,0.6)",
  separator: "#C6C6C8",
  tabInactive: "#8E8E93",
} as const;

export type ColorName = keyof typeof colors;
