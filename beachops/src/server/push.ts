import webpush from "web-push";
import { eq } from "drizzle-orm";
import { getDb, schema } from "./db";

export type PushPayload = {
  title: string;
  body: string;
  /** Ruta a abrir al tocar la notificación (p. ej. /cuadro/2026-07-11) */
  url?: string;
  tag?: string;
};

function vapidConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function configure() {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:admin@example.com",
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
}

/**
 * Envía una notificación a todos los dispositivos suscritos de la org.
 * Las suscripciones caducadas (404/410) se eliminan. Nunca lanza: un fallo
 * de push no debe romper la ingesta de reservas.
 */
export async function sendPushToOrg(orgId: string, payload: PushPayload): Promise<void> {
  if (!vapidConfigured()) return;
  configure();
  const db = await getDb();
  const subs = await db
    .select()
    .from(schema.pushSubscriptions)
    .where(eq(schema.pushSubscriptions.orgId, orgId));

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
        );
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await db
            .delete(schema.pushSubscriptions)
            .where(eq(schema.pushSubscriptions.id, sub.id));
        } else {
          console.error("Push falló:", status, sub.endpoint.slice(0, 60));
        }
      }
    }),
  );
}
