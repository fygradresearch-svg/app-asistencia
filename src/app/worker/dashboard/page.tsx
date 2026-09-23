"use client";

import Link from "next/link";
import {CalendarDays, Clock3, MapPin, ReceiptText} from "lucide-react";
import {useEffect, useState} from "react";

type Totals = { totalLate: number; totalAbsent: number; totalFinesCents: number };
const cards = [{key: "totalLate", label: "Tardanzas", icon: Clock3}, {
    key: "totalAbsent",
    label: "Faltas",
    icon: CalendarDays
}, {key: "fines", label: "Multas", icon: ReceiptText}] as const;
export default function WorkerDashboard() {
    const [name, setName] = useState("Cargando...");
    const [dni, setDni] = useState("");
    const [totals, setTotals] = useState<Totals | null>(null);
    useEffect(() => {
        void Promise.all([fetch("/api/worker/profile").then(r => r.json()), fetch(`/api/worker/history?from=${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`).then(r => r.json())]).then(([profile, history]) => {
            setName(profile.fullName);
            setDni(profile.dni);
            setTotals(history.totals)
        })
    }, []);
    return <main className="min-h-screen bg-[#f5f6f8] p-4 sm:p-6">
        <section className="mx-auto max-w-5xl">
            <header className="rounded-2xl bg-[#132338] p-6 text-white shadow-xl sm:p-8"><p
                className="text-xs font-semibold uppercase tracking-[0.18em] text-[#e8b77f]">Portal del trabajador</p>
                <h1 className="mt-2 text-3xl font-extrabold tracking-tight">{name}</h1><p
                    className="mt-1 text-sm text-white/60">DNI: {dni}</p><Link href="/worker"
                                                                               className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#BC681C] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#9f5717]"><MapPin
                    className="h-4 w-4"/>Marcar asistencia</Link></header>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">{cards.map(card => {
                const Icon = card.icon;
                const value = card.key === "fines" ? `S/. ${((totals?.totalFinesCents ?? 0) / 100).toFixed(2)}` : totals?.[card.key] ?? 0;
                return <article key={card.key} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between"><p className="text-sm font-medium text-slate-500">{card.label}</p><span className="rounded-xl bg-[#BC681C]/10 p-2.5 text-[#BC681C]"><Icon className="h-5 w-5"/></span></div>
                    <p className="mt-4 text-3xl font-extrabold text-[#132338]">{value}</p>
                </article>;
            })}</div>
            <nav className="mt-5 grid gap-3 sm:grid-cols-2"><Link href="/worker/schedule"
                                                                  className="rounded-2xl border border-slate-200 bg-white p-5 text-sm font-semibold text-[#132338] shadow-sm transition hover:-translate-y-0.5 hover:border-[#BC681C] hover:shadow-md">Mi
                horario<span className="mt-1 block font-normal text-slate-500">Consulta los turnos de la semana.</span></Link><Link
                href="/worker/history"
                className="rounded-2xl border border-slate-200 bg-white p-5 text-sm font-semibold text-[#132338] shadow-sm transition hover:-translate-y-0.5 hover:border-[#BC681C] hover:shadow-md">Mi
                historial<span
                    className="mt-1 block font-normal text-slate-500">Revisa horarios, asistencia y multas.</span></Link>
            </nav>
        </section>
    </main>
}
