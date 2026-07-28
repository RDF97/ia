import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BeachOps — Cuadro de reservas",
  description:
    "Cuadro diario de reservas de kayak y paddle surf, actualizado automáticamente desde el correo",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "BeachOps", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className="antialiased bg-slate-50 text-slate-900 min-h-screen">
        {children}
      </body>
    </html>
  );
}
