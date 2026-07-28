/**
 * Parche manual (opcional) para añadir Cala Santanyí / Es Pontàs a bases de datos
 * ya sembradas. Hoy también se hace solo al arrancar el worker y desde el botón
 * "Reprocesar reservas", así que este script rara vez hace falta.
 *
 *   npm run db:upgrade:santanyi
 */
import { runMigrations } from "../src/server/db/migrate";
import { ensureSantanyiConfig } from "../src/server/config/ensure-santanyi";

export async function upgradeSantanyi() {
  await runMigrations();
  await ensureSantanyiConfig();
  console.log("Upgrade Santanyí completado.");
}

if (process.argv[1]?.endsWith("upgrade-santanyi.ts")) {
  upgradeSantanyi().then(() => process.exit(0));
}
