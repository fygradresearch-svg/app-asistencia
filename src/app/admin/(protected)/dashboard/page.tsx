import { Users, UserCheck, CalendarCheck, AlarmClock } from "lucide-react";
import { getDashboardStats } from "@/lib/data";

export const dynamic = "force-dynamic";

const cards = [
  {
    key: "registeredWorkers",
    label: "Trabajadores registrados",
    icon: Users,
    tone: "text-blue-700 bg-blue-50"
  },
  {
    key: "activeWorkers",
    label: "Trabajadores activos",
    icon: UserCheck,
    tone: "text-emerald-700 bg-emerald-50"
  },
  {
    key: "todayAttendance",
    label: "Asistencias de hoy",
    icon: CalendarCheck,
    tone: "text-slate-700 bg-slate-100"
  },
  {
    key: "todayLate",
    label: "Tardanzas de hoy",
    icon: AlarmClock,
    tone: "text-amber-700 bg-amber-50"
  }
] as const;

export default async function AdminDashboardPage() {
  const stats = await getDashboardStats();

  return (
    <div>
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Panel administrador
        </p>
        <h1 className="mt-1 text-3xl font-bold text-slate-950">Dashboard</h1>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article
              key={card.key}
              className="rounded-md border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-500">{card.label}</p>
                  <strong className="mt-2 block text-3xl text-slate-950">
                    {stats[card.key]}
                  </strong>
                </div>
                <span className={`rounded-md p-3 ${card.tone}`}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
