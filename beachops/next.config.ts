import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite (WASM) y googleapis no toleran el empaquetado del servidor de Next.
  serverExternalPackages: ["@electric-sql/pglite", "googleapis", "pg", "imapflow", "mailparser", "playwright-core"],
  output: "standalone",
  // El build del contenedor NO repite lint/type-check: consumen ~1,9 GB y
  // revientan el VPS de 1 GB. Esos checks ya se corren en el repo/CI (npm run
  // lint + npm test) antes de cada push, así que aquí son redundantes.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
