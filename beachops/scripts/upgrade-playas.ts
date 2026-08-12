/**
 * Parche manual (opcional) para poner al día la configuración de playas de una
 * base ya sembrada: funde Playa Barca y Mondragó en una sola y añade Cala
 * Santanyí / Es Pontàs. Hoy también se hace solo al arrancar el worker y desde
 * el botón "Reprocesar reservas", así que este script rara vez hace falta.
 *
 *   npm run db:upgrade:playas
 */
import { runMigrations } from "../src/server/db/migrate";
import { ensureBeachConfig } from "../src/server/config/beaches";

export async function upgradePlayas() {
  await runMigrations();
  await ensureBeachConfig();
  console.log("Configuración de playas al día.");
}

if (process.argv[1]?.endsWith("upgrade-playas.ts")) {
  upgradePlayas().then(() => process.exit(0));
}
