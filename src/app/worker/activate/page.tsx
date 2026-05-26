"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { WORKER_DEVICE_TOKEN_KEY } from "@/lib/client-storage";

export default function WorkerActivatePage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem(WORKER_DEVICE_TOKEN_KEY);
    if (token) {
      router.replace("/worker");
    }
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/worker/activate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code })
    });
    const data = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? "No se pudo activar el acceso.");
      return;
    }

    localStorage.setItem(WORKER_DEVICE_TOKEN_KEY, data.deviceToken);
    router.replace("/worker");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8 text-white">
      <section className="w-full max-w-sm rounded-md border border-slate-800 bg-white p-6 text-slate-950 shadow-soft">
        <div className="mb-6">
          <span className="inline-flex rounded-md bg-emerald-50 p-3 text-emerald-700">
            <KeyRound className="h-6 w-6" aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-2xl font-bold">Activar acceso</h1>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Codigo de 4 digitos</span>
            <input
              value={code}
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, "").slice(0, 4))
              }
              className="mt-2 w-full rounded-md border border-slate-300 px-4 py-4 text-center font-mono text-3xl font-bold tracking-normal outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              inputMode="numeric"
              maxLength={4}
              autoComplete="one-time-code"
            />
          </label>

          {error ? (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading || code.length !== 4}
            className="w-full rounded-md bg-emerald-700 px-4 py-4 text-lg font-bold text-white transition hover:bg-emerald-800 disabled:opacity-60"
          >
            {loading ? "Activando..." : "Activar"}
          </button>
        </form>
      </section>
    </main>
  );
}
