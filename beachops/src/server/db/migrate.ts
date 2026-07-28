import path from "node:path";
import { getDb } from "./index";

/** Aplica las migraciones de /drizzle con el driver que esté activo. */
export async function runMigrations() {
  const db = await getDb();
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  const url = process.env.DATABASE_URL ?? "";
  if (url.startsWith("postgres")) {
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    await migrate(db as never, { migrationsFolder });
  } else {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(db as never, { migrationsFolder });
  }
}
