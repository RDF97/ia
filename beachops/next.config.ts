import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite (WASM) y googleapis no toleran el empaquetado del servidor de Next.
  serverExternalPackages: ["@electric-sql/pglite", "googleapis", "pg", "imapflow", "mailparser"],
  output: "standalone",
};

export default nextConfig;
