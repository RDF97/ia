import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite (WASM) y googleapis no toleran el empaquetado del servidor de Next.
  serverExternalPackages: ["@electric-sql/pglite", "googleapis", "pg", "imapflow", "mailparser", "playwright-core"],
  // El build del contenedor NO repite lint/type-check: consumen ~1,9 GB y
  // revientan el VPS de 1 GB. Esos checks ya se corren en el repo/CI (npm run
  // lint + npm test) antes de cada push, así que aquí son redundantes.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  // Detrás de un proxy inverso (Caddy) con HTTPS, Next bloquea las Server Actions
  // por su comprobación CSRF si el Origin no coincide con el Host reenviado → los
  // botones "no hacen nada". Se permite explícitamente el dominio de producción.
  // (Nota: se quitó `output: standalone`; arrancamos con `next start` sobre el
  // `.next` completo, que es el modo soportado y evita el aviso de incompatibilidad.)
  experimental: {
    serverActions: {
      allowedOrigins: ["booking.lademanu.es"],
    },
  },
};

export default nextConfig;
