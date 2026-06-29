import { Screen } from "@/components/Screen";
import { PhaseCard } from "@/components/Card";

export default function Inicio() {
  return (
    <Screen title="Hola, Ruben 👋" subtitle="Casa Ruben · María">
      <PhaseCard phase="Fase 6 · Inicio">
        Panel resumen del hogar: gastos del mes, tareas de hoy, compra pendiente,
        deudas y precio de la luz ahora. Agrega los demás módulos.
      </PhaseCard>
    </Screen>
  );
}
