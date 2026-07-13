import Link from "next/link";
import { requireSession } from "@/server/auth";
import { logout } from "@/server/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  return (
    <div>
      <nav className="no-print bg-white border-b border-slate-200 px-4 py-2 flex items-center gap-5 text-sm sticky top-0 z-10">
        <span className="font-bold text-blue-700">BeachOps</span>
        <Link href="/" className="hover:text-blue-700">Cuadro</Link>
        <Link href="/reservas" className="hover:text-blue-700">Reservas</Link>
        <Link href="/emails" className="hover:text-blue-700">Emails</Link>
        <Link href="/config" className="hover:text-blue-700">Configuración</Link>
        <span className="ml-auto text-slate-400">{session.email}</span>
        <form action={logout}>
          <button className="text-slate-500 hover:text-red-600">Salir</button>
        </form>
      </nav>
      <main className="max-w-5xl mx-auto p-4">{children}</main>
    </div>
  );
}
