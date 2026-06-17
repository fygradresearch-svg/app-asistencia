import Link from "next/link";

export default function HomePage() {
  return (
      <main className="min-h-screen bg-[#0f2744] flex flex-col">
        {/* Top bar */}
        <header className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
          <div className="w-8 h-8 rounded-lg bg-[#00b4cc] flex items-center justify-center">
            <span className="text-white font-bold text-xs tracking-tight">Fy</span>
          </div>
          <span className="text-white font-semibold text-sm tracking-tight">FyGrad</span>
        </header>

        {/* Hero */}
        <section className="flex-1 flex flex-col justify-center px-6 py-16 max-w-2xl mx-auto w-full">
        <span className="inline-flex items-center gap-2 text-[#00b4cc] text-xs font-semibold uppercase tracking-widest mb-6">
          <span className="w-4 h-px bg-[#00b4cc]" />
          Sistema de Asistencia GPS
        </span>

          <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight mb-4">
            Control de asistencia{" "}
            <span className="text-[#00b4cc]">en tiempo real</span>
          </h1>

          <p className="text-white/50 text-base leading-relaxed mb-12 max-w-md">
            Registra y gestiona la asistencia de tu equipo con validación precisa de
            ubicación GPS. Rápido, confiable y desde cualquier dispositivo.
          </p>

          {/* Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
                href="/admin/login"
                className="group flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 hover:bg-white/10 hover:border-[#00b4cc]/40 transition-all duration-200"
            >
              <div className="w-10 h-10 rounded-xl bg-[#00b4cc]/20 flex items-center justify-center">
                <svg
                    className="w-5 h-5 text-[#00b4cc]"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                  <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-1">
                  Administrador
                </p>
                <p className="text-white font-semibold text-lg leading-tight">
                  Panel de control
                </p>
                <p className="text-white/40 text-sm mt-1">
                  Gestiona trabajadores, turnos e informes.
                </p>
              </div>
              <span className="text-[#00b4cc] text-sm font-semibold flex items-center gap-1 mt-auto">
              Ingresar
              <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </span>
            </Link>

            <Link
                href="/worker"
                className="group flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 hover:bg-white/10 hover:border-[#f07a1a]/40 transition-all duration-200"
            >
              <div className="w-10 h-10 rounded-xl bg-[#f07a1a]/20 flex items-center justify-center">
                <svg
                    className="w-5 h-5 text-[#f07a1a]"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                  <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-1">
                  Trabajador
                </p>
                <p className="text-white font-semibold text-lg leading-tight">
                  Marcar asistencia
                </p>
                <p className="text-white/40 text-sm mt-1">
                  Registra tu entrada y salida con GPS.
                </p>
              </div>
              <span className="text-[#f07a1a] text-sm font-semibold flex items-center gap-1 mt-auto">
              Marcar
              <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </span>
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="px-6 py-4 border-t border-white/10 text-center">
          <p className="text-white/20 text-xs">
            © {new Date().getFullYear()} FyGrad · Sistema Web de Asistencia
          </p>
        </footer>
      </main>
  );
}