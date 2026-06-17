"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { WORKER_DNI_KEY } from "@/lib/client-storage";
import { attendanceStatusLabels, shiftTypeLabels } from "@/lib/labels";

type WorkerMe = {
  id: number;
  fullName: string;
  dni: string;
  status: string;
};

type ShiftRecord = {
  shiftType: "morning" | "afternoon";
  serverTime: string;
  checkOutTime: string | null;
  status: string;
  lateMinutes: number;
  fineAmountCents: number;
  toleranceUsed: boolean;
};

type TodayState = {
  date: string;
  serverTime: string;
  activeShift: "morning" | "afternoon" | null;
  nextAction: "check_in" | "check_out" | "waiting_afternoon" | "complete" | "no_schedule";
  records: ShiftRecord[];
};

type Position = {
  latitude: number;
  longitude: number;
};

function formatTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getCurrentPosition(): Promise<Position> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Tu navegador no soporta geolocalización."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            reject(new Error("Debes permitir el acceso a tu ubicación para marcar asistencia."));
            return;
          }
          reject(new Error("No se pudo obtener tu ubicación GPS."));
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
  });
}

// ─── Subcomponents ───────────────────────────────────────────────────────────

function TopBar({ workerName, onClear }: { workerName?: string; onClear?: () => void }) {
  return (
      <header className="flex items-center justify-between px-5 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#00b4cc] flex items-center justify-center">
            <span className="text-white font-bold text-xs tracking-tight">Fy</span>
          </div>
          <span className="text-white font-semibold text-sm">FyGrad</span>
        </div>
        {workerName && onClear ? (
            <button
                type="button"
                onClick={onClear}
                className="text-white/40 text-xs font-medium hover:text-white/70 transition"
            >
              Cambiar DNI
            </button>
        ) : null}
      </header>
  );
}

function ShiftBlock({ record, label }: { record: ShiftRecord | undefined; label: string }) {
  const statusLabel = record
      ? (attendanceStatusLabels[record.status] ?? record.status)
      : "Sin registro";

  const statusColor = !record
      ? "bg-white/10 text-white/40"
      : record.status === "on_time"
          ? "bg-[#00b4cc]/20 text-[#00b4cc]"
          : record.status === "late"
              ? "bg-[#f07a1a]/20 text-[#f07a1a]"
              : "bg-white/10 text-white/40";

  return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between mb-3">
        <span className="text-white/40 text-xs font-semibold uppercase tracking-widest">
          Turno {label}
        </span>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusColor}`}>
          {statusLabel}
        </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-white/30 text-xs mb-1">Entrada</p>
            <p className="text-white font-semibold text-base">{formatTime(record?.serverTime)}</p>
          </div>
          <div>
            <p className="text-white/30 text-xs mb-1">Salida</p>
            <p className="text-white font-semibold text-base">{formatTime(record?.checkOutTime)}</p>
          </div>
        </div>
        {record?.lateMinutes ? (
            <p className="mt-3 text-[#f07a1a] text-xs font-medium">
              {record.lateMinutes} min de tardanza
            </p>
        ) : null}
      </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function WorkerPage() {
  const [dni, setDni] = useState("");
  const [worker, setWorker] = useState<WorkerMe | null>(null);
  const [today, setToday] = useState<TodayState | null>(null);
  const [now, setNow] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [marking, setMarking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadToday = useCallback(async (workerDni: string) => {
    const response = await fetch("/api/worker/today", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dni: workerDni }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error ?? "No se pudo cargar el estado del día.");
    setToday(data);
  }, []);

  const verifyAccess = useCallback(
      async (workerDni: string) => {
        setLoading(true);
        setError("");
        setMessage("");
        try {
          const position = await getCurrentPosition();
          const response = await fetch("/api/worker/verify", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ dni: workerDni, ...position }),
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) {
            setWorker(null);
            setToday(null);
            setError(data.error ?? "No se pudo validar el acceso.");
            return;
          }
          sessionStorage.setItem(WORKER_DNI_KEY, workerDni);
          setWorker(data.worker);
          await loadToday(workerDni);
        } catch (caught) {
          setWorker(null);
          setToday(null);
          setError(caught instanceof Error ? caught.message : "No se pudo obtener tu ubicación GPS.");
        } finally {
          setLoading(false);
        }
      },
      [loadToday]
  );

  useEffect(() => {
    const storedDni = sessionStorage.getItem(WORKER_DNI_KEY);
    if (storedDni) {
      setDni(storedDni);
      void verifyAccess(storedDni);
    }
  }, [verifyAccess]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  async function submitDni(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await verifyAccess(dni);
  }

  async function mark(type: "check-in" | "check-out") {
    if (!worker) return;
    setMarking(true);
    setMessage("");
    setError("");
    try {
      const position = await getCurrentPosition();
      const response = await fetch(`/api/attendance/${type}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dni: worker.dni, ...position }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "No se pudo registrar la marcación.");
        return;
      }
      setMessage(data.message ?? "Marcación registrada.");
      await loadToday(worker.dni);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo obtener tu ubicación GPS.");
    } finally {
      setMarking(false);
    }
  }

  function clearSession() {
    sessionStorage.removeItem(WORKER_DNI_KEY);
    setWorker(null);
    setToday(null);
    setDni("");
    setMessage("");
    setError("");
  }

  const morningRecord = today?.records.find((r) => r.shiftType === "morning");
  const afternoonRecord = today?.records.find((r) => r.shiftType === "afternoon");
  const shiftLabel = today?.activeShift === "afternoon" ? "tarde" : "mañana";

  const timeString = new Intl.DateTimeFormat("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(now);

  return (
      <main className="min-h-screen bg-[#0f2744] flex flex-col">
        <TopBar workerName={worker?.fullName} onClear={worker ? clearSession : undefined} />

        <div className="flex-1 flex flex-col px-4 py-6 max-w-md mx-auto w-full">
          {/* Page heading */}
          <div className="mb-6">
          <span className="flex items-center gap-2 text-[#00b4cc] text-xs font-semibold uppercase tracking-widest mb-2">
            <span className="w-4 h-px bg-[#00b4cc]" />
            Asistencia GPS
          </span>
            <h1 className="text-2xl font-bold text-white leading-tight">
              {worker?.fullName ?? "Marcar asistencia"}
            </h1>
          </div>

          {/* ── DNI form ── */}
          {!worker ? (
              <div className="bg-white rounded-2xl p-6 shadow-xl">
                <div className="w-12 h-12 rounded-xl bg-[#e0f7fa] flex items-center justify-center mb-5">
                  <svg className="w-6 h-6 text-[#007a8a]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" />
                  </svg>
                </div>

                <h2 className="text-xl font-bold text-[#0f2744] mb-1">Ingresa tu DNI</h2>
                <p className="text-slate-500 text-sm leading-relaxed mb-6">
                  Debes estar dentro de la zona autorizada para registrar asistencia.
                </p>

                <form onSubmit={submitDni} className="space-y-4">
                  <label className="block">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Número de DNI
                </span>
                    <input
                        value={dni}
                        onChange={(e) => setDni(e.target.value.replace(/\D/g, "").slice(0, 8))}
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-center font-mono text-3xl font-bold tracking-widest text-[#0f2744] outline-none transition focus:border-[#00b4cc] focus:bg-white focus:ring-2 focus:ring-[#00b4cc]/20"
                        inputMode="numeric"
                        maxLength={8}
                        autoComplete="off"
                        placeholder="00000000"
                    />
                  </label>

                  {error ? (
                      <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 flex items-start gap-2.5">
                        <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                        </svg>
                        <p className="text-sm font-medium text-red-700">{error}</p>
                      </div>
                  ) : null}

                  <button
                      type="submit"
                      disabled={loading || dni.length !== 8}
                      className="w-full flex items-center justify-center gap-2.5 rounded-xl bg-[#0f2744] px-4 py-4 text-sm font-semibold text-white transition hover:bg-[#1a3a5c] disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#00b4cc]/40"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                    </svg>
                    {loading ? "Validando ubicación..." : "Validar y continuar"}
                  </button>
                </form>
              </div>
          ) : (
              /* ── Attendance panel ── */
              <div className="space-y-4">
                {loading ? (
                    <div className="flex items-center gap-3 text-white/50 text-sm py-8">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Cargando...
                    </div>
                ) : (
                    <>
                      {/* Time row */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3">
                          <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-1">Fecha</p>
                          <p className="text-white font-semibold text-sm">{today?.date}</p>
                        </div>
                        <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3">
                          <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-1">Hora</p>
                          <p className="text-white font-semibold text-sm tabular-nums">{timeString}</p>
                        </div>
                      </div>

                      {/* Shift cards */}
                      <div className="space-y-3">
                        <p className="text-white/40 text-xs font-semibold uppercase tracking-widest flex items-center gap-2">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Estado del día
                        </p>
                        <ShiftBlock record={morningRecord} label={shiftTypeLabels["morning"]} />
                        <ShiftBlock record={afternoonRecord} label={shiftTypeLabels["afternoon"]} />
                      </div>

                      {/* Feedback */}
                      {message ? (
                          <div className="rounded-xl bg-[#00b4cc]/10 border border-[#00b4cc]/20 px-4 py-3 flex items-start gap-2.5">
                            <svg className="w-4 h-4 text-[#00b4cc] mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="text-[#00b4cc] text-sm font-medium">{message}</p>
                          </div>
                      ) : null}

                      {error ? (
                          <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 flex items-start gap-2.5">
                            <svg className="w-4 h-4 text-red-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                            </svg>
                            <p className="text-red-400 text-sm font-medium">{error}</p>
                          </div>
                      ) : null}

                      {/* Action buttons */}
                      <div className="space-y-3 pt-1">
                        {today?.nextAction === "check_in" && (
                            <button
                                type="button"
                                onClick={() => mark("check-in")}
                                disabled={marking}
                                className="w-full flex items-center justify-center gap-3 rounded-xl bg-[#00b4cc] px-4 py-4 text-sm font-semibold text-white transition hover:bg-[#007a8a] disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-[#00b4cc]/50"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                              </svg>
                              {marking ? "Obteniendo GPS..." : `Marcar entrada — turno ${shiftLabel}`}
                            </button>
                        )}

                        {today?.nextAction === "check_out" && (
                            <button
                                type="button"
                                onClick={() => mark("check-out")}
                                disabled={marking}
                                className="w-full flex items-center justify-center gap-3 rounded-xl bg-[#f07a1a] px-4 py-4 text-sm font-semibold text-white transition hover:bg-[#c45c00] disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-[#f07a1a]/50"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z" />
                              </svg>
                              {marking ? "Obteniendo GPS..." : "Marcar salida"}
                            </button>
                        )}

                        {today?.nextAction === "complete" && (
                            <div className="flex items-center gap-3 rounded-xl bg-[#00b4cc]/10 border border-[#00b4cc]/20 px-5 py-4">
                              <svg className="w-5 h-5 text-[#00b4cc] shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span className="text-[#00b4cc] font-semibold text-sm">Asistencia completa por hoy</span>
                            </div>
                        )}

                        {today?.nextAction === "waiting_afternoon" && (
                            <div className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 px-5 py-4">
                              <svg className="w-5 h-5 text-white/40 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span className="text-white/60 font-semibold text-sm">Turno de la mañana completo · Esperando turno tarde</span>
                            </div>
                        )}

                        {today?.nextAction === "no_schedule" && (
                            <div className="flex items-center gap-3 rounded-xl bg-[#f07a1a]/10 border border-[#f07a1a]/20 px-5 py-4">
                              <svg className="w-5 h-5 text-[#f07a1a] shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
                              </svg>
                              <span className="text-[#f07a1a] font-semibold text-sm">No tienes turno asignado para hoy</span>
                            </div>
                        )}
                      </div>
                    </>
                )}
              </div>
          )}
        </div>
      </main>
  );
}