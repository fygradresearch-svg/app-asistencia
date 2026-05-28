"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, LogOut, Play, Square } from "lucide-react";
import { WORKER_DEVICE_TOKEN_KEY } from "@/lib/client-storage";
import { attendanceStatusLabels } from "@/lib/labels";

type WorkerMe = {
  id: number;
  fullName: string;
  status: string;
};

type TodayState = {
  date: string;
  serverTime: string;
  activeShift: "morning" | "afternoon" | null;
  nextAction: "check_in" | "check_out" | "waiting_afternoon" | "complete" | "no_schedule";
  record: {
    checkInTime: string | null;
    checkOutTime: string | null;
    afternoonCheckInTime: string | null;
    afternoonCheckOutTime: string | null;
    attendanceStatus: string;
  } | null;
};

type Position = {
  latitude: number;
  longitude: number;
};

function formatTime(value: string | null | undefined) {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("es-PE", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function getCurrentPosition(): Promise<Position> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Tu navegador no soporta geolocalizacion."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(
            new Error("Debes permitir el acceso a tu ubicacion para marcar asistencia.")
          );
          return;
        }
        reject(new Error("No se pudo obtener tu ubicacion GPS."));
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000
      }
    );
  });
}

export default function WorkerPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [worker, setWorker] = useState<WorkerMe | null>(null);
  const [today, setToday] = useState<TodayState | null>(null);
  const [now, setNow] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const authHeaders = useCallback(
    () => ({
      authorization: `Bearer ${token}`
    }),
    [token]
  );

  const clearToken = useCallback(() => {
    localStorage.removeItem(WORKER_DEVICE_TOKEN_KEY);
    router.replace("/worker/activate");
  }, [router]);

  const load = useCallback(
    async (deviceToken: string) => {
      setLoading(true);
      setError("");

      const headers = { authorization: `Bearer ${deviceToken}` };
      const [meResponse, todayResponse] = await Promise.all([
        fetch("/api/worker/me", { headers }),
        fetch("/api/worker/today", { headers })
      ]);

      if (!meResponse.ok || !todayResponse.ok) {
        clearToken();
        return;
      }

      setWorker(await meResponse.json());
      setToday(await todayResponse.json());
      setLoading(false);
    },
    [clearToken]
  );

  useEffect(() => {
    const storedToken = localStorage.getItem(WORKER_DEVICE_TOKEN_KEY);
    if (!storedToken) {
      router.replace("/worker/activate");
      return;
    }
    setToken(storedToken);
    void load(storedToken);
  }, [load, router]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  async function mark(type: "check-in" | "check-out") {
    if (!token) {
      clearToken();
      return;
    }

    setMarking(true);
    setMessage("");
    setError("");

    try {
      const position = await getCurrentPosition();
      const response = await fetch(`/api/attendance/${type}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...authHeaders()
        },
        body: JSON.stringify(position)
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error ?? "No se pudo registrar la marcacion.");
        setMarking(false);
        return;
      }

      setMessage(data.message ?? "Marcacion registrada.");
      await load(token);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo obtener tu ubicacion GPS.");
    } finally {
      setMarking(false);
    }
  }

  const statusText = today?.record?.attendanceStatus
    ? attendanceStatusLabels[today.record.attendanceStatus] ?? today.record.attendanceStatus
    : "Sin entrada";
  const shiftLabel = today?.activeShift === "afternoon" ? "tarde" : "manana";

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-5 text-white">
      <section className="mx-auto flex min-h-[calc(100vh-40px)] w-full max-w-md flex-col">
        <header className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-300">
              Asistencia GPS
            </p>
            <h1 className="mt-1 text-2xl font-bold leading-tight">
              {worker?.fullName ?? "Trabajador"}
            </h1>
          </div>
          <button
            type="button"
            onClick={clearToken}
            className="rounded-md border border-slate-700 p-2 text-slate-200"
            aria-label="Cerrar acceso"
            title="Cerrar acceso"
          >
            <LogOut className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <section className="rounded-md border border-slate-800 bg-white p-5 text-slate-950 shadow-soft">
          {loading ? (
            <p className="text-sm font-semibold text-slate-500">Cargando...</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md bg-slate-100 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Fecha
                  </p>
                  <strong className="mt-1 block text-lg">{today?.date}</strong>
                </div>
                <div className="rounded-md bg-slate-100 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Hora
                  </p>
                  <strong className="mt-1 block text-lg">
                    {new Intl.DateTimeFormat("es-PE", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit"
                    }).format(now)}
                  </strong>
                </div>
              </div>

              <div className="mt-4 rounded-md border border-slate-200 p-4">
                <div className="mb-3 flex items-center gap-2 text-slate-700">
                  <Clock className="h-4 w-4" aria-hidden="true" />
                  <span className="text-sm font-semibold">Estado del dia</span>
                </div>
                <strong className="block text-2xl text-slate-950">{statusText}</strong>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-slate-500">Entrada manana</span>
                    <strong className="block text-slate-950">
                      {formatTime(today?.record?.checkInTime)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Salida manana</span>
                    <strong className="block text-slate-950">
                      {formatTime(today?.record?.checkOutTime)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Entrada tarde</span>
                    <strong className="block text-slate-950">
                      {formatTime(today?.record?.afternoonCheckInTime)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Salida tarde</span>
                    <strong className="block text-slate-950">
                      {formatTime(today?.record?.afternoonCheckOutTime)}
                    </strong>
                  </div>
                </div>
              </div>

              {message ? (
                <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                  {message}
                </p>
              ) : null}
              {error ? (
                <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                  {error}
                </p>
              ) : null}

              <div className="mt-5 space-y-3">
                {today?.nextAction === "check_in" ? (
                  <button
                    type="button"
                    onClick={() => mark("check-in")}
                    disabled={marking}
                    className="flex w-full items-center justify-center gap-3 rounded-md bg-emerald-700 px-4 py-5 text-lg font-bold text-white transition hover:bg-emerald-800 disabled:opacity-60"
                  >
                    <Play className="h-6 w-6" aria-hidden="true" />
                    {marking ? "Obteniendo GPS..." : `Marcar entrada ${shiftLabel}`}
                  </button>
                ) : null}

                {today?.nextAction === "check_out" ? (
                  <button
                    type="button"
                    onClick={() => mark("check-out")}
                    disabled={marking}
                    className="flex w-full items-center justify-center gap-3 rounded-md bg-blue-700 px-4 py-5 text-lg font-bold text-white transition hover:bg-blue-800 disabled:opacity-60"
                  >
                    <Square className="h-6 w-6" aria-hidden="true" />
                    {marking ? "Obteniendo GPS..." : "Marcar salida"}
                  </button>
                ) : null}

                {today?.nextAction === "complete" ? (
                  <div className="flex items-center gap-3 rounded-md bg-emerald-50 px-4 py-5 font-bold text-emerald-800">
                    <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
                    Asistencia completa por hoy
                  </div>
                ) : null}

                {today?.nextAction === "waiting_afternoon" ? (
                  <div className="flex items-center gap-3 rounded-md bg-blue-50 px-4 py-5 font-bold text-blue-800">
                    <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
                    Turno de la manana completo
                  </div>
                ) : null}

                {today?.nextAction === "no_schedule" ? (
                  <div className="flex items-center gap-3 rounded-md bg-amber-50 px-4 py-5 font-bold text-amber-800">
                    <Clock className="h-6 w-6" aria-hidden="true" />
                    No tienes turno asignado para hoy
                  </div>
                ) : null}
              </div>
            </>
          )}
        </section>

        <div className="mt-auto" />
      </section>
    </main>
  );
}
