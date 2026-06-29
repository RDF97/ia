import { Screen } from "@/components/Screen";
import { PhaseCard } from "@/components/Card";

export default function Compra() {
  return (
    <Screen title="Compra" subtitle="Lista colaborativa y precios">
      <PhaseCard phase="Fase 3 · Compra">
        Lista de la compra en tiempo real, base de datos de productos con histórico de
        precios y OCR de tickets para el súper más barato.
      </PhaseCard>
    </Screen>
  );
}
