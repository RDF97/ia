import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

process.env.PGLITE_DIR = "memory://";
process.env.TOKEN_ENCRYPTION_KEY = "0".repeat(64);

import { getDb, schema } from "../src/server/db";
import { sendPushToOrg } from "../src/server/push";
import { seed } from "../scripts/seed";

let orgId: string;

beforeAll(async () => {
  orgId = (await seed()) as string;
});

describe("notificaciones push", () => {
  it("guarda la suscripción una sola vez aunque se registre dos veces", async () => {
    const db = await getDb();
    const values = {
      orgId,
      endpoint: "https://push.example.com/sub-1",
      p256dh: "clave-p256dh",
      auth: "clave-auth",
    };
    await db.insert(schema.pushSubscriptions).values(values).onConflictDoNothing();
    await db.insert(schema.pushSubscriptions).values(values).onConflictDoNothing();
    const rows = await db
      .select()
      .from(schema.pushSubscriptions)
      .where(eq(schema.pushSubscriptions.orgId, orgId));
    expect(rows).toHaveLength(1);
  });

  it("sin claves VAPID no envía nada y no lanza", async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    await expect(
      sendPushToOrg(orgId, { title: "t", body: "b" }),
    ).resolves.toBeUndefined();
  });

  it("un endpoint muerto no rompe el envío (la ingesta nunca debe caerse por un push)", async () => {
    // Claves VAPID válidas de prueba, endpoint inexistente → el envío falla
    // por red y sendPushToOrg debe tragarse el error.
    const webpush = await import("web-push");
    const keys = webpush.default.generateVAPIDKeys();
    process.env.VAPID_PUBLIC_KEY = keys.publicKey;
    process.env.VAPID_PRIVATE_KEY = keys.privateKey;
    await expect(
      sendPushToOrg(orgId, { title: "t", body: "b", url: "/" }),
    ).resolves.toBeUndefined();
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
  });
});
