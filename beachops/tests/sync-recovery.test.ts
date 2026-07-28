import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

process.env.PGLITE_DIR = "memory://";
process.env.TOKEN_ENCRYPTION_KEY = "0".repeat(64);

import { getDb, schema } from "../src/server/db";
import { runMigrations } from "../src/server/db/migrate";
import { syncAllAccounts } from "../src/server/gmail/sync";

let orgId: string;

beforeAll(async () => {
  await runMigrations();
  const db = await getDb();
  const [org] = await db
    .insert(schema.orgs)
    .values({ name: "Org Sync", slug: "org-sync" })
    .returning();
  orgId = org.id;
});

describe("recuperación de la sincronización de correo", () => {
  it("una cuenta que falló ANTES se vuelve a intentar (no queda muerta)", async () => {
    const db = await getDb();
    // Cuenta que quedó marcada en error por un fallo puntual. El bug real era que
    // quedaba excluida de la sincronización para siempre y nadie la reintentaba.
    const [account] = await db
      .insert(schema.emailAccounts)
      .values({
        orgId,
        provider: "gmail",
        emailAddress: "buzon@example.com",
        // Token ilegible: al reintentar vuelve a fallar, pero con un error NUEVO.
        refreshTokenEnc: "no-es-un-token-valido",
        syncStatus: "error",
        lastError: "fallo puntual del día 19",
      })
      .returning();

    await syncAllAccounts();

    const [after] = await db
      .select()
      .from(schema.emailAccounts)
      .where(eq(schema.emailAccounts.id, account.id));
    // Si se hubiera saltado la cuenta, el error seguiría siendo el viejo.
    expect(after.lastError).not.toBe("fallo puntual del día 19");
  });

  it("una cuenta revocada NO se reintenta (necesita reconexión manual)", async () => {
    const db = await getDb();
    const [revoked] = await db
      .insert(schema.emailAccounts)
      .values({
        orgId,
        provider: "gmail",
        emailAddress: "revocada@example.com",
        refreshTokenEnc: null,
        syncStatus: "revoked",
        lastError: "token revocado",
      })
      .returning();

    await syncAllAccounts();

    const [after] = await db
      .select()
      .from(schema.emailAccounts)
      .where(eq(schema.emailAccounts.id, revoked.id));
    expect(after.syncStatus).toBe("revoked");
  });
});
