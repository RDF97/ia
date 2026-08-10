import { useEffect, useRef } from "react";
import { client } from "./appwrite";
import { DB_ID, EXPENSES_COL } from "./db";
import { ensureNotificationPermissions, notifyNow } from "./notifications";
import { expenseAlertText, shouldAlert } from "./expenseAlertLogic";
import type { Expense } from "./expenses";

export { expenseAlertText, shouldAlert } from "./expenseAlertLogic";

/**
 * Aviso cuando otra persona del hogar apunta un gasto.
 *
 * Va por el canal de tiempo real de Appwrite y dispara una notificación LOCAL.
 * Eso significa que llega mientras la app está viva (en primer plano o hace poco
 * que la cerraste). Para que llegue con el móvil guardado en el bolsillo y la app
 * cerrada hace falta push de verdad (Expo Push + credenciales FCM + una función
 * de Appwrite que la envíe); está anotado como siguiente paso.
 */
export function useExpenseAlerts(hogarId: string | undefined, myName: string): void {
  // Los nombres cambian sin que haga falta resuscribirse; una ref evita cortar
  // y rehacer la conexión de tiempo real cada vez que se repinta.
  const name = useRef(myName);
  name.current = myName;

  useEffect(() => {
    if (!hogarId) return;
    // Sin permiso no hay aviso, y el sistema solo pregunta la primera vez.
    ensureNotificationPermissions().catch(() => undefined);
    const seen = new Set<string>();
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = client.subscribe(
        `databases.${DB_ID}.collections.${EXPENSES_COL}.documents`,
        (msg: { events?: string[]; payload?: unknown }) => {
          if (!msg.events?.some((ev) => ev.endsWith(".create"))) return;
          const doc = msg.payload as Expense | undefined;
          if (!doc?.$id || seen.has(doc.$id)) return;
          seen.add(doc.$id);
          if (!shouldAlert(doc, hogarId, name.current)) return;
          const { title, body } = expenseAlertText(doc);
          notifyNow(title, body).catch(() => undefined);
        },
      );
    } catch {
      /* sin tiempo real no hay aviso, pero la app sigue funcionando */
    }
    return () => {
      try {
        unsubscribe?.();
      } catch {
        /* noop */
      }
    };
  }, [hogarId]);
}
