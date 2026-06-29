import { Screen } from "@/components/Screen";
import { PhaseCard } from "@/components/Card";

export default function Calendario() {
  return (
    <Screen title="Calendario" subtitle="Eventos del hogar">
      <PhaseCard phase="Fase 5 · Calendario">
        Vista mensual y agenda con eventos por miembro y sincronización con el
        calendario del dispositivo.
      </PhaseCard>
    </Screen>
  );
}
