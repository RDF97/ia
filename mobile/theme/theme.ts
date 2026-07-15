import { useColorScheme } from "react-native";

// Paleta semántica claro/oscuro alineada con Apple HIG (system colors).
export interface Theme {
  dark: boolean;
  bg: string;
  card: string;
  elevated: string;
  fill: string; // relleno sutil (inputs, chips)
  label: string;
  labelSecondary: string;
  labelTertiary: string;
  separator: string;
  accent: string;
  accentSoft: string;
  onAccent: string;
  green: string;
  orange: string;
  red: string;
  blue: string;
  teal: string;
  purple: string;
  pink: string;
  gray: string;
  tabInactive: string;
  overlay: string;
}

const light: Theme = {
  dark: false,
  bg: "#F2F2F7",
  card: "#FFFFFF",
  elevated: "#FFFFFF",
  fill: "rgba(118,118,128,0.12)",
  label: "#000000",
  labelSecondary: "rgba(60,60,67,0.6)",
  labelTertiary: "rgba(60,60,67,0.3)",
  separator: "#C6C6C8",
  accent: "#1F4D52",
  accentSoft: "rgba(31,77,82,0.10)",
  onAccent: "#FFFFFF",
  green: "#34C759",
  orange: "#FF9500",
  red: "#FF3B30",
  blue: "#007AFF",
  teal: "#5AC8FA",
  purple: "#AF52DE",
  pink: "#FF2D55",
  gray: "#8E8E93",
  tabInactive: "#8E8E93",
  overlay: "rgba(0,0,0,0.40)",
};

const dark: Theme = {
  dark: true,
  bg: "#000000",
  card: "#1C1C1E",
  elevated: "#2C2C2E",
  fill: "rgba(118,118,128,0.24)",
  label: "#FFFFFF",
  labelSecondary: "rgba(235,235,245,0.6)",
  labelTertiary: "rgba(235,235,245,0.3)",
  separator: "#38383A",
  accent: "#3FA5AD",
  accentSoft: "rgba(63,165,173,0.18)",
  onAccent: "#FFFFFF",
  green: "#30D158",
  orange: "#FF9F0A",
  red: "#FF453A",
  blue: "#0A84FF",
  teal: "#64D2FF",
  purple: "#BF5AF2",
  pink: "#FF375F",
  gray: "#8E8E93",
  tabInactive: "#8E8E93",
  overlay: "rgba(0,0,0,0.55)",
};

export function useTheme(): Theme {
  return useColorScheme() === "dark" ? dark : light;
}

export { light as lightTheme, dark as darkTheme };
