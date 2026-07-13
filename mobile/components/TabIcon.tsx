import Svg, { Path, Rect } from "react-native-svg";

// Iconos EXACTOS de la tab bar del mockup (trazo fino estilo SF Symbols).
// Paths copiados 1:1 del HTML original; activo = trazo 2, inactivo = 1.7.

export type TabIconName = "inicio" | "gastos" | "compra" | "tareas" | "calendario" | "luz";

const PATHS: Record<Exclude<TabIconName, "calendario">, string> = {
  inicio: "M3 11l9-7 9 7M5 10v9a1 1 0 001 1h12a1 1 0 001-1v-9",
  gastos: "M12 2v20M16 6H9.5a3.5 3.5 0 100 7H14a3.5 3.5 0 110 7H7",
  compra: "M5 6h14l-1.5 11a2 2 0 01-2 1.7h-7a2 2 0 01-2-1.7L5 6zM8 6V4a2 2 0 012-2h4a2 2 0 012 2v2",
  tareas: "M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11",
  luz: "M13 2L3 14h7l-1 8 10-12h-7l1-8z",
};

export function TabIcon({
  name,
  color,
  focused,
  size = 26,
}: {
  name: TabIconName;
  color: string;
  focused: boolean;
  size?: number;
}) {
  const sw = focused ? 2 : 1.7;
  const common = {
    stroke: color,
    strokeWidth: sw,
    fill: "none" as const,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === "calendario" ? (
        <>
          <Rect x={3} y={5} width={18} height={16} rx={2} {...common} />
          <Path d="M3 10h18M8 3v4M16 3v4" {...common} />
        </>
      ) : (
        <Path d={PATHS[name]} {...common} />
      )}
    </Svg>
  );
}
