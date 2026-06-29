import { Screen } from "@/components/Screen";
import { PhaseCard } from "@/components/Card";

export default function Tareas() {
  return (
    <Screen title="Tareas" subtitle="Reparto del hogar">
      <PhaseCard phase="Fase 2 · Tareas">
        Tareas asignadas y recurrentes con sincronización en tiempo real entre los
        miembros del hogar y recordatorios push.
      </PhaseCard>
    </Screen>
  );
}
