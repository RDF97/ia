import { Screen } from "@/components/Screen";
import { PhaseCard } from "@/components/Card";

export default function Gastos() {
  return (
    <Screen title="Gastos" subtitle="Presupuesto y reparto del hogar">
      <PhaseCard phase="Fase 4 · Gastos">
        Presupuesto por categoría, movimientos, “quién debe a quién” y liquidaciones.
        Se vincula con los tickets de Compra.
      </PhaseCard>
    </Screen>
  );
}
