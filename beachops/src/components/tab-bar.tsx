"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Navegación principal. En móvil, barra de pestañas inferior (patrón de las HIG
 * de Apple: destinos de primer nivel siempre a mano, al alcance del pulgar y
 * respetando la barra de inicio). En escritorio se oculta: allí manda la barra
 * superior.
 */

type Tab = { href: string; label: string; icon: React.ReactNode; match: (p: string) => boolean };

export function TabBar({ weekHref }: { weekHref: string }) {
  const pathname = usePathname();

  const tabs: Tab[] = [
    {
      href: "/",
      label: "Cuadro",
      match: (p) => p === "/" || p.startsWith("/cuadro"),
      icon: <IconBoard />,
    },
    {
      href: weekHref,
      label: "Semana",
      match: (p) => p.startsWith("/semana"),
      icon: <IconWeek />,
    },
    {
      href: "/reservas",
      label: "Reservas",
      match: (p) => p.startsWith("/reservas"),
      icon: <IconList />,
    },
    {
      href: "/emails",
      label: "Emails",
      match: (p) => p.startsWith("/emails"),
      icon: <IconMail />,
    },
    {
      href: "/config",
      label: "Ajustes",
      match: (p) => p.startsWith("/config"),
      icon: <IconGear />,
    },
  ];

  return (
    <nav
      className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/85 backdrop-blur-lg md:hidden safe-bottom"
      aria-label="Navegación principal"
    >
      <ul className="flex">
        {tabs.map((tab) => {
          const active = tab.match(pathname);
          return (
            <li key={tab.label} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[52px] flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium transition-colors active:bg-slate-100 ${
                  active ? "text-blue-600" : "text-slate-500"
                }`}
              >
                <span aria-hidden>{tab.icon}</span>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// Iconos en línea (sin dependencias): trazo de 1.8, estilo SF Symbols.
const svg = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function IconBoard() {
  return (
    <svg {...svg}>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M3 9h18M8 4v16" />
    </svg>
  );
}
function IconWeek() {
  return (
    <svg {...svg}>
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}
function IconList() {
  return (
    <svg {...svg}>
      <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
    </svg>
  );
}
function IconMail() {
  return (
    <svg {...svg}>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </svg>
  );
}
function IconGear() {
  return (
    <svg {...svg}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2 5.5 5.5" />
    </svg>
  );
}
