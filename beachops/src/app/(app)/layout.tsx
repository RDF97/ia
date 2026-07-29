import Link from "next/link";
import { requireSession } from "@/server/auth";
import { logout } from "@/server/actions";
import { TabBar } from "@/components/tab-bar";
import { todayInTz } from "@/server/board/query";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const weekHref = `/semana/${todayInTz("Europe/Madrid")}`;

  return (
    <div>
      {/* Escritorio: barra superior. En móvil manda la barra de pestañas. */}
      <nav className="no-print sticky top-0 z-30 hidden items-center gap-5 border-b border-slate-200 bg-white/90 px-4 py-2 text-sm backdrop-blur md:flex">
        <span className="font-bold text-blue-700">BeachOps</span>
        <Link href="/" className="hover:text-blue-700">Cuadro</Link>
        <Link href={weekHref} className="hover:text-blue-700">Semana</Link>
        <Link href="/reservas" className="hover:text-blue-700">Reservas</Link>
        <Link href="/emails" className="hover:text-blue-700">Emails</Link>
        <Link href="/config" className="hover:text-blue-700">Configuración</Link>
        <span className="ml-auto text-slate-400">{session.email}</span>
        <form action={logout}>
          <button className="text-slate-500 hover:text-red-600">Salir</button>
        </form>
      </nav>

      <main className="mx-auto max-w-5xl p-3 pb-tabbar md:p-4 md:pb-4">{children}</main>

      <TabBar weekHref={weekHref} />
    </div>
  );
}
