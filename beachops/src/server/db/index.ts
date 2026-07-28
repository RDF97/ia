import * as schema from "./schema";

type Db = ReturnType<typeof import("drizzle-orm/node-postgres").drizzle<typeof schema>>;

const globalForDb = globalThis as unknown as { __beachopsDb?: unknown };

async function createDb() {
  const url = process.env.DATABASE_URL ?? "";
  if (url.startsWith("postgres")) {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { Pool } = await import("pg");
    return drizzle(new Pool({ connectionString: url }), { schema });
  }
  // Sin DATABASE_URL: PGlite embebido (desarrollo/tests), persistido en disco.
  const { drizzle } = await import("drizzle-orm/pglite");
  const dir = process.env.PGLITE_DIR ?? ".data/pglite";
  return drizzle(dir, { schema });
}

export async function getDb(): Promise<Db> {
  if (!globalForDb.__beachopsDb) {
    globalForDb.__beachopsDb = await createDb();
  }
  return globalForDb.__beachopsDb as Db;
}

export { schema };
