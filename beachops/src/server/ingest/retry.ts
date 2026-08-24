import { and, asc, inArray, lt, or, isNull } from "drizzle-orm";
import { getDb, schema } from "../db";
import { processRawEmail } from "./process";

/**
 * Rescate automático de los emails que se quedaron por el camino.
 *
 * Son dos casos, y ninguno se arregla solo si nadie los mira:
 *
 * - **Fallidos**: el parser no supo leer esa plantilla (y en el despliegue
 *   siguiente puede que ya sí), o falló algo puntual al procesarlo.
 * - **Pendientes**: el email entró en la base y el worker se reinició antes de
 *   procesarlo. Se quedaban ahí para siempre, y con ellos su reserva.
 *
 * Con calma, eso sí: cada intento fallido espera más que el anterior, y a los
 * ocho se para. Un email que ha fallado ocho veces no se arregla insistiendo;
 * lo que necesita es que alguien lo mire, y para eso está la lista de Emails.
 */
export const MAX_ATTEMPTS = 8;

/** Espera antes del siguiente intento: 5 min, 15, 45, 2 h, 6 h… hasta 24 h. */
export function backoffMinutes(attempts: number): number {
  return Math.min(5 * 3 ** Math.max(0, attempts - 1), 24 * 60);
}

export type RetryOptions = {
  /** Ignora la espera y reintenta ya (al arrancar, tras un despliegue). */
  ignoreBackoff?: boolean;
  /** Tope de emails por pasada, para no comerse un ciclo entero del worker. */
  limit?: number;
  now?: Date;
};

/**
 * Vuelve a intentar los emails marcados como fallidos que ya han cumplido su
 * espera. No vuelve a notificar: el aviso ya se dio la primera vez.
 *
 * @returns cuántos se reintentaron.
 */
let enCurso = false;

export async function retryFailedEmails(opts: RetryOptions = {}): Promise<number> {
  // El repaso del arranque y el de cada ciclo pueden solaparse; sin esto los dos
  // cogen los mismos emails y se hace el trabajo por duplicado.
  if (enCurso) return 0;
  enCurso = true;
  try {
    return await recuperar(opts);
  } finally {
    enCurso = false;
  }
}

async function recuperar(opts: RetryOptions): Promise<number> {
  const { ignoreBackoff = false, limit = 50, now = new Date() } = opts;
  const db = await getDb();

  const candidatos = await db
    .select()
    .from(schema.rawEmails)
    .where(
      and(
        inArray(schema.rawEmails.parseStatus, ["failed", "pending"]),
        lt(schema.rawEmails.parseAttempts, MAX_ATTEMPTS),
        // Sin fecha de proceso no hay espera que cumplir: se intenta ya.
        ignoreBackoff
          ? undefined
          : or(
              isNull(schema.rawEmails.processedAt),
              lt(schema.rawEmails.processedAt, new Date(now.getTime() - 5 * 60_000)),
            ),
      ),
    )
    .orderBy(asc(schema.rawEmails.processedAt))
    .limit(limit);

  // La espera exacta depende de los intentos de CADA email, así que el filtro
  // fino se hace aquí (en SQL solo se descarta lo obvio).
  const toca = candidatos.filter((raw) => {
    if (ignoreBackoff || !raw.processedAt) return true;
    const espera = backoffMinutes(raw.parseAttempts) * 60_000;
    return now.getTime() - raw.processedAt.getTime() >= espera;
  });

  for (const raw of toca) {
    // Un pendiente nunca llegó a avisar de su reserva, así que ese aviso sí
    // toca darlo; de un fallido ya se avisó en su día.
    await processRawEmail(raw, { retry: raw.parseStatus === "failed" });
  }
  return toca.length;
}
