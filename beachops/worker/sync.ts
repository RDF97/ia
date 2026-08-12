/**
 * Worker de sincronización: consulta Gmail cada SYNC_INTERVAL_MS (60 s por
 * defecto) para todas las cuentas activas. En Railway se ejecuta como
 * proceso aparte: `npm run worker`.
 */
import { runMigrations } from "../src/server/db/migrate";
import { ensureBeachConfig } from "../src/server/config/beaches";
import { reprocessBookingEmails } from "../src/server/ingest/reprocess";
import { syncAllAccounts } from "../src/server/gmail/sync";

const INTERVAL = Number(process.env.SYNC_INTERVAL_MS ?? 60_000);

async function main() {
  await runMigrations();
  // Deja al día la config de playas en bases ya sembradas (idempotente): funde
  // Playa Barca con Mondragó y crea Cala Santanyí / Es Pontàs. Si algo cambió,
  // reprocesa las reservas para repartirlas a su playa. El reproceso puede
  // tardar (muchos emails), así que va EN SEGUNDO PLANO: sincronizar el correo
  // es lo prioritario y nunca debe quedar bloqueado por esto.
  ensureBeachConfig()
    .then(async (created) => {
      if (!created) return;
      const n = await reprocessBookingEmails();
      console.log(`Config de playas actualizada: reprocesadas ${n} reservas.`);
    })
    .catch((err) => console.error("ensureBeachConfig/reprocess falló (se continúa):", err));

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
