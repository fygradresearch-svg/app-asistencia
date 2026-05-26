"use client";

import { FormEvent, useEffect, useState } from "react";
import { MapPin, Save } from "lucide-react";

type LocationFormState = {
  name: string;
  latitude: string;
  longitude: string;
  allowedRadiusMeters: string;
};

export function LocationForm() {
  const [form, setForm] = useState<LocationFormState>({
    name: "",
    latitude: "",
    longitude: "",
    allowedRadiusMeters: ""
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const response = await fetch("/api/admin/location");
      const data = await response.json().catch(() => ({}));
      setLoading(false);

      if (response.ok) {
        setForm({
          name: data.name ?? "",
          latitude: String(data.latitude ?? ""),
          longitude: String(data.longitude ?? ""),
          allowedRadiusMeters: String(data.allowedRadiusMeters ?? "")
        });
      } else {
        setError(data.error ?? "No se pudo cargar la ubicacion.");
      }
    }

    void load();
  }, []);

  function updateField(name: keyof LocationFormState, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    const response = await fetch("/api/admin/location", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        latitude: form.latitude,
        longitude: form.longitude,
        allowedRadiusMeters: form.allowedRadiusMeters
      })
    });
    const data = await response.json().catch(() => ({}));
    setSaving(false);

    if (!response.ok) {
      setError(data.error ?? "No se pudo guardar la ubicacion.");
      return;
    }

    setForm({
      name: data.name,
      latitude: String(data.latitude),
      longitude: String(data.longitude),
      allowedRadiusMeters: String(data.allowedRadiusMeters)
    });
    setMessage("Ubicacion guardada.");
  }

  return (
    <div>
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Panel administrador
        </p>
        <h1 className="mt-1 text-3xl font-bold text-slate-950">Ubicacion autorizada</h1>
      </div>

      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <span className="rounded-md bg-blue-50 p-3 text-blue-700">
            <MapPin className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-slate-950">Sede</h2>
            <p className="text-sm text-slate-500">Radio permitido en metros</p>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Cargando...</p>
        ) : (
          <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
            <label className="md:col-span-2">
              <span className="text-sm font-medium text-slate-700">Nombre de sede</span>
              <input
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <label>
              <span className="text-sm font-medium text-slate-700">Latitud</span>
              <input
                value={form.latitude}
                onChange={(event) => updateField("latitude", event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                inputMode="decimal"
              />
            </label>

            <label>
              <span className="text-sm font-medium text-slate-700">Longitud</span>
              <input
                value={form.longitude}
                onChange={(event) => updateField("longitude", event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                inputMode="decimal"
              />
            </label>

            <label>
              <span className="text-sm font-medium text-slate-700">Radio permitido</span>
              <input
                value={form.allowedRadiusMeters}
                onChange={(event) => updateField("allowedRadiusMeters", event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                inputMode="numeric"
              />
            </label>

            <div className="flex items-end">
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
