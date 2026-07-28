import { and, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "../db";
import { processRawEmail } from "./process";

/**
 * Re-aplica el pipeline (parseo + mapeo) a los emails de reserva ya recibidos,
 * de modo que las reglas nuevas (p. ej. Es Pontàs → Cala Santanyí) muevan también
 * las reservas que ya estaban en el cuadro. Idempotente.
 *
 * @param orgId  si se indica, solo esa org; si no, todas (uso del worker).
 */
export async function reprocessBookingEmails(orgId?: string): Promise<number> {
  const db = await getDb();
  const emails = await db
    .select()
    .from(schema.rawEmails)
    .where(
      orgId
        ? and(
            eq(schema.rawEmails.orgId, orgId),
            inArray(schema.rawEmails.parseStatus, ["parsed", "failed", "pending"]),
          )
        : inArray(schema.rawEmails.parseStatus, ["parsed", "failed", "pending"]),
    );
  for (const raw of emails) {
    await processRawEmail(raw);
  }
  return emails.length;
}
