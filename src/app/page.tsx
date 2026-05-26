import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-5 py-10">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Sistema Web de Asistencia con Validacion GPS
        </p>
        <h1 className="mt-3 max-w-3xl text-4xl font-bold tracking-normal text-slate-950 md:text-5xl">
          Control de asistencia para trabajadores con validacion de ubicacion.
        </h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/admin/login"
          className="rounded-md border border-slate-200 bg-white p-6 shadow-soft transition hover:border-emerald-300"
        >
          <span className="text-sm font-semibold text-slate-500">Administrador</span>
          <strong className="mt-2 block text-2xl text-slate-950">Panel admin</strong>
        </Link>
        <Link
          href="/worker"
          className="rounded-md border border-slate-200 bg-white p-6 shadow-soft transition hover:border-blue-300"
        >
          <span className="text-sm font-semibold text-slate-500">Trabajador</span>
          <strong className="mt-2 block text-2xl text-slate-950">Marcar asistencia</strong>
        </Link>
      </div>
    </main>
  );
}
