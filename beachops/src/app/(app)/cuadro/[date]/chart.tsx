import { ChartBar } from "@/server/board/query";

/**
 * Gráfico de barras hora × personas (instructivo §5). SVG inline, sin
 * librerías, imprimible. Cada barra suma todas las actividades de esa hora y
 * usa el color del umbral (§3.5). viewBox 700×260, márgenes 42/34/16.
 */
export function BoardChart({ bars }: { bars: ChartBar[] }) {
  if (bars.length === 0) return null;

  const W = 700;
  const H = 260;
  const mL = 42;
  const mR = 16;
  const mT = 16;
  const mB = 34;
  const plotW = W - mL - mR;
  const plotH = H - mT - mB;
  const yMax = Math.max(20, ...bars.map((b) => b.pax));
  const band = plotW / bars.length;
  const barW = Math.min(60, band * 0.6);

  const y = (v: number) => mT + plotH - (v / yMax) * plotH;
  const ticks = Array.from({ length: 5 }, (_, i) => Math.round((yMax / 4) * i));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto"
      role="img"
      aria-label="Personas por franja horaria"
      style={{ maxWidth: 700 }}
    >
      {/* Rejilla y eje Y */}
      {ticks.map((t) => (
        <g key={t}>
          <line x1={mL} y1={y(t)} x2={W - mR} y2={y(t)} stroke="#E2E0DA" strokeWidth={1} />
          <text x={mL - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="#8A8778">
            {t}
          </text>
        </g>
      ))}
      {/* Barras */}
      {bars.map((b, i) => {
        const cx = mL + band * i + band / 2;
        const h = mT + plotH - y(b.pax);
        return (
          <g key={b.hora}>
            <rect
              x={cx - barW / 2}
              y={y(b.pax)}
              width={barW}
              height={h}
              rx={3}
              fill={b.hex}
            />
            <text x={cx} y={y(b.pax) - 6} textAnchor="middle" fontSize={12} fontWeight={700} fill="#3B3A33">
              {b.pax}
            </text>
            <text x={cx} y={H - mB + 18} textAnchor="middle" fontSize={11} fill="#5B594F">
              {b.hora}
            </text>
          </g>
        );
      })}
      {/* Eje X base */}
      <line x1={mL} y1={mT + plotH} x2={W - mR} y2={mT + plotH} stroke="#B8B5A9" strokeWidth={1} />
    </svg>
  );
}
