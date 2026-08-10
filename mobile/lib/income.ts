import AsyncStorage from "@react-native-async-storage/async-storage";
import { cancelScheduled, notificationsGranted, scheduleAt } from "./notifications";
import { endOfMonth, savingsNotice } from "./incomeLogic";

export { monthBalance, savingsNotice, endOfMonth, type MonthBalance } from "./incomeLogic";

// El ingreso en sí vive en `incomes.ts` (colección compartida con el hogar).
// Aquí solo queda el aviso de fin de mes, que es local a este móvil.
const NOTIF_KEY = (hogarId: string) => `income-notif:${hogarId}`;

/**
 * Programa el resumen de fin de mes con lo gastado HASTA AHORA.
 *
 * Ojo: es una notificación local, así que el texto se congela en el momento de
 * programarla. Por eso se reprograma cada vez que cambia el gasto del mes: el
 * aviso que acaba saltando lleva la última cifra conocida.
 */
export async function scheduleMonthSummary(
  hogarId: string,
  income: number,
  spent: number,
  now: Date = new Date(),
): Promise<void> {
  const prev = await AsyncStorage.getItem(NOTIF_KEY(hogarId));
  if (prev) {
    try {
      const { id } = JSON.parse(prev) as { id: string };
      await cancelScheduled([id]);
    } catch {
      /* nada que cancelar */
    }
    await AsyncStorage.removeItem(NOTIF_KEY(hogarId));
  }
  if (income <= 0) return;
  if (!(await notificationsGranted())) return;

  const { title, body } = savingsNotice(income, spent);
  const id = await scheduleAt(endOfMonth(now), title, body);
  if (id) await AsyncStorage.setItem(NOTIF_KEY(hogarId), JSON.stringify({ id }));
}
