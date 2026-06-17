"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? "No se pudo iniciar sesión.");
      return;
    }

    router.replace("/admin/dashboard");
  }

  return (
      <main className="min-h-screen bg-[#0f2744] flex flex-col">
        {/* Top bar */}
        <header className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
          <div className="w-8 h-8 rounded-lg bg-[#00b4cc] flex items-center justify-center">
            <span className="text-white font-bold text-xs tracking-tight">Fy</span>
          </div>
          <span className="text-white font-semibold text-sm tracking-tight">FyGrad</span>
        </header>

        {/* Content */}
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-sm">
            {/* Eyebrow */}
            <div className="flex items-center gap-2 mb-8">
              <span className="w-4 h-px bg-[#00b4cc]" />
              <span className="text-[#00b4cc] text-xs font-semibold uppercase tracking-widest">
              Administrador
            </span>
            </div>

            {/* Card */}
            <div className="bg-white rounded-2xl p-8 shadow-xl">
              {/* Icon */}
              <div className="w-12 h-12 rounded-xl bg-[#0f2744] flex items-center justify-center mb-6">
                <svg
                    className="w-6 h-6 text-[#00b4cc]"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                  <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                  />
                </svg>
              </div>

              <h1 className="text-2xl font-bold text-[#0f2744] mb-1">Iniciar sesión</h1>
              <p className="text-slate-500 text-sm mb-7 leading-relaxed">
                Acceso exclusivo para administradores del sistema.
              </p>

              <form onSubmit={onSubmit} className="space-y-4">
                <label className="block">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Usuario
                </span>
                  <input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-[#0f2744] outline-none transition focus:border-[#00b4cc] focus:bg-white focus:ring-2 focus:ring-[#00b4cc]/20"
                      autoComplete="username"
                  />
                </label>

                <label className="block">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Contraseña
                </span>
                  <input
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      type="password"
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-[#0f2744] outline-none transition focus:border-[#00b4cc] focus:bg-white focus:ring-2 focus:ring-[#00b4cc]/20"
                      autoComplete="current-password"
                  />
                </label>

                {error ? (
                    <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 flex items-start gap-3">
                      <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                      </svg>
                      <p className="text-sm font-medium text-red-700">{error}</p>
                    </div>
                ) : null}

                <button
                    type="submit"
                    disabled={loading}
                    className="mt-2 w-full flex items-center justify-center gap-2 rounded-xl bg-[#0f2744] px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-[#1a3a5c] disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-[#00b4cc]/40"
                >
                  {loading ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Ingresando...
                      </>
                  ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                        </svg>
                        Ingresar al panel
                      </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>
  );
}