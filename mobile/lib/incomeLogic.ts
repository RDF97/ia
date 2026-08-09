// Lógica pura de "ingreso mensual y cuánto me queda". Sin backend ni AsyncStorage:
// así se puede probar entera con tests.

export interface MonthBalance {
  income: number;
  spent: number;
  /** Ingreso − gastado. Negativo = te has pasado. */
  left: number;
  /** Porción del ingreso ya gastada, entre 0 y 1 (recortado, para la barra). */
  pct: number;
  /** Te has gastado más de lo que ingresas. */
  over: boolean;
}

/** Cuánto te queda este mes dado tu ingreso y lo que llevas gastado. */
export function monthBalance(income: number, spent: number): MonthBalance {
  const left = income - spent;
  const pct = income > 0 ? Math.min(1, Math.max(0, spent / income)) : 0;
  return { income, spent, left, pct, over: left < 0 };
}

/** Último instante del mes de `d` (23:59 del último día). Para el aviso de fin de mes. */
export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 0, 0);
}

const eur = (v: number) => `${Math.abs(v).toFixed(2).replace(".", ",")} €`;

export interface SavingsNotice {
  title: string;
  body: string;
}

/**
 * Mensaje del resumen de fin de mes. Si has ahorrado, felicita; si te has
 * pasado, lo dice sin dramatizar (mentir aquí no ayuda a nadie).
 */
export function savingsNotice(income: number, spent: number): SavingsNotice {
  const { left, over } = monthBalance(income, spent);
  if (over) {
    return {
      title: "📊 Resumen del mes",
      body: `Has gastado ${eur(spent)} de ${eur(income)}: ${eur(left)} por encima. El mes que viene lo ajustamos.`,
    };
  }
  if (left === 0) {
    return { title: "📊 Resumen del mes", body: `Has gastado justo tus ${eur(income)}. Ni ahorro ni deuda.` };
  }
  return {
    title: "🎉 ¡Felicidades!",
    body: `Este mes has conseguido ahorrar ${eur(left)}. Gastaste ${eur(spent)} de ${eur(income)}.`,
  };
}
