/**
 * Worker de sincronización: consulta Gmail cada SYNC_INTERVAL_MS (60 s por
 * defecto) para todas las cuentas activas. En Railway se ejecuta como
 * proceso aparte: `npm run worker`.
 */
import { runMigrations } from "../src/server/db/migrate";
import { ensureSantanyiConfig } from "../src/server/config/ensure-santanyi";
import { reprocessBookingEmails } from "../src/server/ingest/reprocess";
import { syncAllAccounts } from "../src/server/gmail/sync";

const INTERVAL = Number(process.env.SYNC_INTERVAL_MS ?? 60_000);

async function main() {
  await runMigrations();
  // Deja lista la config de Cala Santanyí / Es Pontàs en bases ya sembradas
  // (idempotente). Si es la PRIMERA vez que se crea la playa, reprocesa las
  // reservas existentes para repartirlas a su playa (separa el cuadro sin que el
  // usuario tenga que pulsar nada). No debe bloquear el arranque si algo falla.
  try {
    const created = await ensureSantanyiConfig();
    if (created) {
      const n = await reprocessBookingEmails();
      console.log(`Cala Santanyí creada: reprocesadas ${n} reservas para separarlas por playa.`);
    }
  } catch (err) {
    console.error("ensureSantanyiConfig/reprocess falló (se continúa):", err);
  }
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
