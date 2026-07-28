import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 30_000,
    // Las migraciones de PGLite en cada beforeAll son lentas cuando varios
    // ficheros corren en paralelo con poca CPU.
    hookTimeout: 30_000,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
