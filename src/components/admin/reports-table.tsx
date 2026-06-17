"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Download, Filter, RefreshCw } from "lucide-react";
import { attendanceStatusLabels, shiftTypeLabels } from "@/lib/labels";

type WorkerOption = {
  id: number;
  fullName: string;
};

type ReportRow = {
  id: number;
  workerName: string;
  workerDni: string;
  date: string;
  shiftType: "morning" | "afternoon";
  serverTime: string;
  checkOutTime: string | null;
  status: string;
  lateMinutes: number;
  fineAmountCents: number;
  toleranceUsed: boolean;
};

type WorkerTotals = {
  workerId: number;
  workerName: string;
  workerDni: string;
  totalLate: number;
  totalAbsent: number;
  totalFinesCents: number;
};

type Filters = {
  date: string;
  from: string;
  to: string;
  workerId: string;
};

function formatTime(value: string | null) {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("es-PE", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function moneyLabel(value: number) {
  return value ? `S/. ${(value / 100).toFixed(2)}` : "S/. 0.00";
}

export function ReportsTable() {
  const [workers, setWorkers] = useState<WorkerOption[]>([]);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [totals, setTotals] = useState<WorkerTotals[]>([]);
  const [filters, setFilters] = useState<Filters>({
    date: "",
    from: "",
    to: "",
    workerId: ""
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      }
    });
    return params.toString();
  }, [filters]);

  async function loadRows(nextQuery = queryString) {
    setLoading(true);
    setError("");
    const response = await fetch(`/api/admin/attendance${nextQuery ? `?${nextQuery}` : ""}`);
    const data = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? "No se pudo cargar el reporte.");
      return;
    }

    setRows(data.rows ?? []);
    setTotals(data.totals ?? []);
  }

  useEffect(() => {
    async function loadInitial() {
      const [workersResponse] = await Promise.all([fetch("/api/admin/workers"), loadRows("")]);
      const workersData = await workersResponse.json().catch(() => []);
      if (workersResponse.ok) {
        setWorkers(workersData);
      }
    }

    void loadInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateFilter(name: keyof Filters, value: string) {
    setFilters((current) => ({
      ...current,
      [name]: value,
      ...(name === "date" && value ? { from: "", to: "" } : {}),
      ...((name === "from" || name === "to") && value ? { date: "" } : {})
    }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadRows();
  }

  const exportHref = `/api/admin/export${queryString ? `?${queryString}` : ""}`;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            Panel administrador
          </p>
          <h1 className="mt-1 text-3xl font-bold text-slate-950">Reportes</h1>
        </div>
        <a
          href={exportHref}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Exportar XLS
        </a>
      </div>

      <section className="mb-6 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-5">
          <label>
            <span className="text-sm font-medium text-slate-700">Fecha</span>
            <input
              type="date"
              value={filters.date}
              onChange={(event) => updateFilter("date", event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>

          <label>
            <span className="text-sm font-medium text-slate-700">Desde</span>
            <input
              type="date"
              value={filters.from}
              onChange={(event) => updateFilter("from", event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>

          <label>
            <span className="text-sm font-medium text-slate-700">Hasta</span>
            <input
              type="date"
              value={filters.to}
              onChange={(event) => updateFilter("to", event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>

          <label>
            <span className="text-sm font-medium text-slate-700">Trabajador</span>
            <select
              value={filters.workerId}
              onChange={(event) => updateFilter("workerId", event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            >
              <option value="">Todos</option>
              {workers.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {worker.fullName}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2 font-semibold text-white transition hover:bg-emerald-800"
            >
              <Filter className="h-4 w-4" aria-hidden="true" />
              Filtrar
            </button>
            <button
              type="button"
              onClick={() => loadRows()}
              className="rounded-md border border-slate-200 p-2 text-slate-700 transition hover:bg-slate-100"
              aria-label="Actualizar reporte"
              title="Actualizar reporte"
            >
              <RefreshCw className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </form>
      </section>

      {error ? (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          {error}
        </p>
      ) : null}

      <section className="mb-6 overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1200px] w-full text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-3">Nombre completo</th>
                <th className="px-4 py-3">DNI</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Turno</th>
                <th className="px-4 py-3">Entrada</th>
                <th className="px-4 py-3">Salida</th>
                <th className="px-4 py-3">Minutos de retraso</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Multa aplicada</th>
                <th className="px-4 py-3">Tolerancia utilizada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td className="px-4 py-5 text-slate-500" colSpan={10}>
                    Cargando...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-5 text-slate-500" colSpan={10}>
                    No hay registros para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="px-4 py-3 font-semibold text-slate-950">
                      {row.workerName}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700">{row.workerDni}</td>
                    <td className="px-4 py-3 text-slate-700">{row.date}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {shiftTypeLabels[row.shiftType] ?? row.shiftType}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{formatTime(row.serverTime)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatTime(row.checkOutTime)}</td>
                    <td className="px-4 py-3 text-slate-700">{row.lateMinutes}</td>
                    <td className="px-4 py-3">
                      {attendanceStatusLabels[row.status] ?? row.status}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-950">
                      {moneyLabel(row.fineAmountCents)}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {row.toleranceUsed ? "Si" : "No"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-lg font-bold text-slate-950">Totales por trabajador</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[720px] w-full text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-3">Nombre completo</th>
                <th className="px-4 py-3">DNI</th>
                <th className="px-4 py-3">Total tardanzas</th>
                <th className="px-4 py-3">Total faltas</th>
                <th className="px-4 py-3">Total multas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td className="px-4 py-5 text-slate-500" colSpan={5}>
                    Cargando...
                  </td>
                </tr>
              ) : totals.length === 0 ? (
                <tr>
                  <td className="px-4 py-5 text-slate-500" colSpan={5}>
                    No hay totales para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                totals.map((total) => (
                  <tr key={total.workerId}>
                    <td className="px-4 py-3 font-semibold text-slate-950">
                      {total.workerName}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700">{total.workerDni}</td>
                    <td className="px-4 py-3 text-slate-700">{total.totalLate}</td>
                    <td className="px-4 py-3 text-slate-700">{total.totalAbsent}</td>
                    <td className="px-4 py-3 font-bold text-slate-950">
                      {moneyLabel(total.totalFinesCents)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
