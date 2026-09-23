"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Clock,
  FileText,
  LayoutDashboard,
  LogOut,
  MapPin,
  Users
} from "lucide-react";

const links = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/workers", label: "Trabajadores", icon: Users },
  { href: "/admin/location", label: "Ubicacion", icon: MapPin },
  { href: "/admin/schedule", label: "Horario", icon: Clock },
  { href: "/admin/reports", label: "Reportes", icon: FileText }
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
  }

  return (
    <div className="min-h-screen bg-[#f5f6f8]">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-white/10 bg-[#132338] px-4 py-6 shadow-2xl lg:block">
        <Link href="/admin/dashboard" className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#e8b77f]">
            Sistema GPS
          </span>
          <strong className="mt-1 block text-xl leading-tight text-white">
            Asistencia
          </strong>
        </Link>

        <nav className="mt-8 space-y-1">
          {links.map((link) => {
            const Icon = link.icon;
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-[#BC681C] text-white shadow-lg shadow-black/10"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {link.label}
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={logout}
          className="absolute bottom-5 left-4 right-4 flex items-center justify-center gap-2 rounded-xl border border-white/15 px-3 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Salir
        </button>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-[#132338]/10 bg-white/95 px-4 py-3 shadow-sm backdrop-blur lg:hidden">
          <div className="mb-3 flex items-center justify-between">
            <Link href="/admin/dashboard" className="font-bold text-[#132338]">
              Asistencia GPS
            </Link>
            <button
              type="button"
              onClick={logout}
              className="rounded-xl border border-slate-200 p-2 text-[#132338]"
              aria-label="Cerrar sesion"
              title="Cerrar sesion"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <nav className="flex gap-2 overflow-x-auto pb-1">
            {links.map((link) => {
              const Icon = link.icon;
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${
                    active
                      ? "bg-[#132338] text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
