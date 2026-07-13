import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL ?? "";

export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  ...(url.startsWith("postgres")
    ? { dbCredentials: { url } }
    : { driver: "pglite", dbCredentials: { url: process.env.PGLITE_DIR ?? ".data/pglite" } }),
});
