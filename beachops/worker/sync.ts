/**
 * Worker de sincronización: consulta Gmail cada SYNC_INTERVAL_MS (60 s por
 * defecto) para todas las cuentas activas. En Railway se ejecuta como
 * proceso aparte: `npm run worker`.
 */
import { runMigrations } from "../src/server/db/migrate";
import { syncAllAccounts } from "../src/server/gmail/sync";

const INTERVAL = Number(process.env.SYNC_INTERVAL_MS ?? 60_000);

async function main() {
  await runMigrations();
  console.log(`Worker de sincronización arrancado (cada ${INTERVAL / 1000}s)`);
  for (;;) {
    const started = Date.now();
    try {
      await syncAllAccounts();
    } catch (err) {
      console.error("Ciclo de sync falló:", err);
    }
    const elapsed = Date.now() - started;
    await new Promise((r) => setTimeout(r, Math.max(1_000, INTERVAL - elapsed)));
  }
}

main();
