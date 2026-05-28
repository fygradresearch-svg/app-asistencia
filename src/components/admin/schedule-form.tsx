"use client";

import { FormEvent, useEffect, useState } from "react";
import { Clock, Save } from "lucide-react";
import { DEFAULT_SHIFT_SCHEDULE } from "@/lib/defaults";

type ScheduleFormState = {
  morningEntryTime: string;
  morningExitTime: string;
  afternoonEntryTime: string;
  afternoonExitTime: string;
  toleranceMinutes: string;
};

export function ScheduleForm() {
  const [form, setForm] = useState<ScheduleFormState>({
    morningEntryTime: "",
    morningExitTime: DEFAULT_SHIFT_SCHEDULE.morningExitTime,
    afternoonEntryTime: DEFAULT_SHIFT_SCHEDULE.afternoonEntryTime,
    afternoonExitTime: "",
    toleranceMinutes: ""
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const response = await fetch("/api/admin/schedule");
      const data = await response.json().catch(() => ({}));
      setLoading(false);

      if (response.ok) {
        setForm({
          morningEntryTime:
            data.entryTime?.slice(0, 5) ?? DEFAULT_SHIFT_SCHEDULE.morningEntryTime,
          morningExitTime: DEFAULT_SHIFT_SCHEDULE.morningExitTime,
          afternoonEntryTime: DEFAULT_SHIFT_SCHEDULE.afternoonEntryTime,
          afternoonExitTime:
            data.exitTime?.slice(0, 5) ?? DEFAULT_SHIFT_SCHEDULE.afternoonExitTime,
          toleranceMinutes: String(data.toleranceMinutes ?? "")
        });
      } else {
        setError(data.error ?? "No se pudo cargar el horario.");
      }
    }

    void load();
  }, []);

  function updateField(name: keyof ScheduleFormState, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    const response = await fetch("/api/admin/schedule", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        entryTime: form.morningEntryTime,
        exitTime: form.afternoonExitTime,
        toleranceMinutes: form.toleranceMinutes
      })
    });
    const data = await response.json().catch(() => ({}));
    setSaving(false);

    if (!response.ok) {
      setError(data.error ?? "No se pudo guardar el horario.");
      return;
    }

    setForm({
      morningEntryTime:
        data.entryTime?.slice(0, 5) ?? DEFAULT_SHIFT_SCHEDULE.morningEntryTime,
      morningExitTime: DEFAULT_SHIFT_SCHEDULE.morningExitTime,
      afternoonEntryTime: DEFAULT_SHIFT_SCHEDULE.afternoonEntryTime,
      afternoonExitTime:
        data.exitTime?.slice(0, 5) ?? DEFAULT_SHIFT_SCHEDULE.afternoonExitTime,
      toleranceMinutes: String(data.toleranceMinutes ?? "")
    });
    setMessage("Horario guardado.");
  }

  return (
    <div>
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Panel administrador
        </p>
        <h1 className="mt-1 text-3xl font-bold text-slate-950">Horario laboral</h1>
      </div>

      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <span className="rounded-md bg-amber-50 p-3 text-amber-700">
            <Clock className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-slate-950">Jornada</h2>
            <p className="text-sm text-slate-500">Horario general con turno manana y tarde</p>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Cargando...</p>
        ) : (
          <form onSubmit={submit} className="grid gap-4 md:grid-cols-5">
            <label>
              <span className="text-sm font-medium text-slate-700">Entrada manana</span>
              <input
                type="time"
                value={form.morningEntryTime}
                onChange={(event) => updateField("morningEntryTime", event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <label>
              <span className="text-sm font-medium text-slate-700">Salida manana</span>
              <input
                type="time"
                value={form.morningExitTime}
                disabled
                className="mt-1 w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-slate-500 outline-none"
              />
            </label>

            <label>
              <span className="text-sm font-medium text-slate-700">Entrada tarde</span>
              <input
                type="time"
                value={form.afternoonEntryTime}
                disabled
                className="mt-1 w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-slate-500 outline-none"
              />
            </label>

            <label>
              <span className="text-sm font-medium text-slate-700">Salida tarde</span>
              <input
                type="time"
                value={form.afternoonExitTime}
                onChange={(event) => updateField("afternoonExitTime", event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <label>
              <span className="text-sm font-medium text-slate-700">Minutos de tolerancia</span>
              <input
                value={form.toleranceMinutes}
                onChange={(event) => updateField("toleranceMinutes", event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                inputMode="numeric"
              />
            </label>

            <div className="md:col-span-5">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2 font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-60 sm:w-auto"
              >
                <Save className="h-4 w-4" aria-hidden="true" />
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        )}

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
      </section>
    </div>
  );
}
