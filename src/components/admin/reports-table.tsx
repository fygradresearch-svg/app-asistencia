"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Download, Filter, RefreshCw, Edit2, X, Clock, ShieldAlert, CheckCircle2, AlertCircle, Info, Trash2 } from "lucide-react";
import { attendanceStatusLabels, shiftTypeLabels } from "@/lib/labels";

type WorkerOption = {
  id: number;
  fullName: string;
};

type ReportRow = {
  id: number;
  workerId: number;
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
  deviceFingerprint: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  checkOutFingerprint: string | null;
  checkOutIp: string | null;
  checkOutUserAgent: string | null;
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

type OverrideForm = {
  morningEntryTime: string;
  morningExitTime: string;
  afternoonEntryTime: string;
  afternoonExitTime: string;
  toleranceMinutes: number;
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

function formatTimeOnlyString(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
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

  // Edit and Override modal state
  const [selectedRow, setSelectedRow] = useState<ReportRow | null>(null);
  const [modalTab, setModalTab] = useState<"attendance" | "schedule">("attendance");
  const [editCheckIn, setEditCheckIn] = useState("");
  const [editCheckOut, setEditCheckOut] = useState("");
  const [overrideForm, setOverrideForm] = useState<OverrideForm>({
    morningEntryTime: "",
    morningExitTime: "",
    afternoonEntryTime: "",
    afternoonExitTime: "",
    toleranceMinutes: 0
  });
  const [hasOverride, setHasOverride] = useState(false);
  const [modalSaving, setModalSaving] = useState(false);
  const [modalError, setModalError] = useState("");
  const [modalSuccess, setModalSuccess] = useState("");

  // Create Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createWorkerId, setCreateWorkerId] = useState("");
  const [createDate, setCreateDate] = useState("");
  const [createShiftType, setCreateShiftType] = useState<"morning" | "afternoon">("morning");
  const [createCheckIn, setCreateCheckIn] = useState("");
  const [createCheckOut, setCreateCheckOut] = useState("");
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [createSaving, setCreateSaving] = useState(false);

  function openCreateModal() {
    setCreateWorkerId("");
    const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
    setCreateDate(todayStr);
    setCreateShiftType("morning");
    setCreateCheckIn("");
    setCreateCheckOut("");
    setCreateError("");
    setCreateSuccess("");
    setShowCreateModal(true);
  }

  async function handleCreateAttendance() {
    if (!createWorkerId || !createDate || !createShiftType || !createCheckIn) {
      setCreateError("Todos los campos excepto la salida son obligatorios.");
      return;
    }
    setCreateSaving(true);
    setCreateError("");
    setCreateSuccess("");

    try {
      const response = await fetch("/api/admin/attendance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workerId: Number(createWorkerId),
          date: createDate,
          shiftType: createShiftType,
          checkInTime: createCheckIn,
          checkOutTime: createCheckOut || null
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setCreateError(data.error ?? "No se pudo registrar la asistencia.");
      } else {
        setCreateSuccess("Asistencia registrada y penalidades calculadas.");
        void loadRows();
        setTimeout(() => {
          setShowCreateModal(false);
        }, 1500);
      }
    } catch {
      setCreateError("Error de red al conectar con el servidor.");
    } finally {
      setCreateSaving(false);
    }
  }

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

  // Edit Modal triggers
  async function openEditModal(row: ReportRow) {
    setSelectedRow(row);
    setModalTab("attendance");
    setEditCheckIn(formatTimeOnlyString(row.serverTime));
    setEditCheckOut(formatTimeOnlyString(row.checkOutTime));
    setModalError("");
    setModalSuccess("");
    setHasOverride(false);

    // Fetch daily override
    try {
      const res = await fetch(`/api/admin/schedule/overrides?workerId=${row.workerId}&date=${row.date}`);
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data) {
          setOverrideForm({
            morningEntryTime: data.morningEntryTime ?? "",
            morningExitTime: data.morningExitTime ?? "",
            afternoonEntryTime: data.afternoonEntryTime ?? "",
            afternoonExitTime: data.afternoonExitTime ?? "",
            toleranceMinutes: data.toleranceMinutes ?? 0
          });
          setHasOverride(true);
        } else {
          setOverrideForm({
            morningEntryTime: "",
            morningExitTime: "",
            afternoonEntryTime: "",
            afternoonExitTime: "",
            toleranceMinutes: 0
          });
        }
      }
    } catch {
      // Keep empty form
    }
  }

  function closeEditModal() {
    setSelectedRow(null);
  }

  async function handleSaveAttendance() {
    if (!selectedRow) return;
    setModalSaving(true);
    setModalError("");
    setModalSuccess("");

    try {
      const response = await fetch("/api/admin/attendance", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: selectedRow.id,
          checkInTime: editCheckIn,
          checkOutTime: editCheckOut || null
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setModalError(data.error ?? "No se pudo actualizar la asistencia.");
      } else {
        setModalSuccess("Asistencia actualizada y reglas de negocio recalculadas.");
        void loadRows();
      }
    } catch {
      setModalError("Error al conectar con el servidor.");
    } finally {
      setModalSaving(false);
    }
  }

  async function handleSaveOverride() {
    if (!selectedRow) return;
    setModalSaving(true);
    setModalError("");
    setModalSuccess("");

    try {
      const response = await fetch("/api/admin/schedule/overrides", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workerId: selectedRow.workerId,
          date: selectedRow.date,
          morningEntryTime: overrideForm.morningEntryTime || null,
          morningExitTime: overrideForm.morningExitTime || null,
          afternoonEntryTime: overrideForm.afternoonEntryTime || null,
          afternoonExitTime: overrideForm.afternoonExitTime || null,
          toleranceMinutes: Number(overrideForm.toleranceMinutes)
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setModalError(data.error ?? "No se pudo actualizar el horario.");
      } else {
        setModalSuccess("Horario especial asignado y asistencia recalculada.");
        setHasOverride(true);
        void loadRows();
      }
    } catch {
      setModalError("Error al conectar con el servidor.");
    } finally {
      setModalSaving(false);
    }
  }

  async function handleDeleteOverride() {
    if (!selectedRow) return;
    setModalSaving(true);
    setModalError("");
    setModalSuccess("");

    try {
      const response = await fetch(
        `/api/admin/schedule/overrides?workerId=${selectedRow.workerId}&date=${selectedRow.date}`,
        { method: "DELETE" }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setModalError(data.error ?? "No se pudo eliminar el horario especial.");
      } else {
        setModalSuccess("Horario especial eliminado. Se reestableció el horario base.");
        setOverrideForm({
          morningEntryTime: "",
          morningExitTime: "",
          afternoonEntryTime: "",
          afternoonExitTime: "",
          toleranceMinutes: 0
        });
        setHasOverride(false);
        void loadRows();
      }
    } catch {
      setModalError("Error al conectar con el servidor.");
    } finally {
      setModalSaving(false);
    }
  }

  const exportHref = `/api/admin/export${queryString ? `?${queryString}` : ""}`;

  // Metrics for overview cards
  const stats = useMemo(() => {
    let totalFine = 0;
    let lateCount = 0;
    let punctualCount = 0;
    let toleranceCount = 0;

    rows.forEach((r) => {
      totalFine += r.fineAmountCents;
      if (r.status === "punctual") punctualCount++;
      else if (r.status === "tolerance") toleranceCount++;
      else if (r.status === "late") lateCount++;
    });

    return { totalFine, lateCount, punctualCount, toleranceCount };
  }, [rows]);

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-800 bg-emerald-100 rounded-full">
            Panel de Control
          </span>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Reporte de Asistencia
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Administra el control de ingreso/salida, penalidades y ajusta horarios excepcionales.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-850 hover:shadow active:scale-[0.98]"
          >
            Nueva Asistencia
          </button>
          <a
            href={exportHref}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:shadow active:scale-[0.98]"
          >
            <Download className="h-4.5 w-4.5" aria-hidden="true" />
            Exportar XLS
          </a>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Recaudado</span>
            <span className="rounded-lg bg-red-50 p-1.5 text-red-600">S/.</span>
          </div>
          <p className="mt-2 text-3xl font-bold text-slate-900">{moneyLabel(stats.totalFine)}</p>
          <p className="mt-1 text-xs text-slate-500">Acumulado en multas aplicadas</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Tardanzas</span>
            <Clock className="h-5 w-5 text-amber-500" />
          </div>
          <p className="mt-2 text-3xl font-bold text-slate-900">{stats.lateCount}</p>
          <p className="mt-1 text-xs text-slate-500">Registros fuera de tolerancia</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Tolerancia Utilizada</span>
            <Info className="h-5 w-5 text-teal-500" />
          </div>
          <p className="mt-2 text-3xl font-bold text-slate-900">{stats.toleranceCount}</p>
          <p className="mt-1 text-xs text-slate-500">Tolerancia de 0-9 min consumida</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Puntuales</span>
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          </div>
          <p className="mt-2 text-3xl font-bold text-slate-900">{stats.punctualCount}</p>
          <p className="mt-1 text-xs text-slate-500">Ingresos dentro de la hora base</p>
        </div>
      </div>

      {/* Filter Section */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 md:grid-cols-5 md:items-end">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Fecha Única</span>
            <input
              type="date"
              value={filters.date}
              onChange={(event) => updateFilter("date", event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100/50"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Desde</span>
            <input
              type="date"
              value={filters.from}
              onChange={(event) => updateFilter("from", event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100/50"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Hasta</span>
            <input
              type="date"
              value={filters.to}
              onChange={(event) => updateFilter("to", event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100/50"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Trabajador</span>
            <select
              value={filters.workerId}
              onChange={(event) => updateFilter("workerId", event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100/50"
            >
              <option value="">Todos</option>
              {workers.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {worker.fullName}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 active:scale-[0.98]"
            >
              <Filter className="h-4 w-4" aria-hidden="true" />
              Filtrar
            </button>
            <button
              type="button"
              onClick={() => loadRows()}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-3 text-slate-700 transition hover:bg-slate-50 active:scale-[0.98]"
              aria-label="Actualizar reporte"
              title="Actualizar reporte"
            >
              <RefreshCw className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </form>
      </section>

      {error ? (
        <div className="rounded-xl bg-red-50 border border-red-100 p-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      {/* Main Attendance Records Table */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse min-w-[1100px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-600">
              <tr>
                <th className="px-5 py-4">Nombre Completo</th>
                <th className="px-5 py-4">DNI</th>
                <th className="px-5 py-4">Fecha</th>
                <th className="px-5 py-4">Turno</th>
                <th className="px-5 py-4">Entrada</th>
                <th className="px-5 py-4">Salida</th>
                <th className="px-5 py-4 text-center">Retraso</th>
                <th className="px-5 py-4">Estado</th>
                <th className="px-5 py-4">Multa</th>
                <th className="px-5 py-4 text-center">Tolerancia</th>
                <th className="px-5 py-4 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td className="px-5 py-8 text-center text-slate-500" colSpan={11}>
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="h-5 w-5 animate-spin text-emerald-600" />
                      Cargando registros...
                    </div>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="px-5 py-8 text-center text-slate-500" colSpan={11}>
                    No hay registros de asistencia para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  let badgeStyle = "bg-slate-100 text-slate-700";
                  if (row.status === "punctual") badgeStyle = "bg-emerald-50 text-emerald-700 border border-emerald-200/50";
                  else if (row.status === "tolerance") badgeStyle = "bg-teal-50 text-teal-700 border border-teal-200/50";
                  else if (row.status === "late") badgeStyle = "bg-amber-50 text-amber-700 border border-amber-200/50";
                  else if (row.status === "absent") badgeStyle = "bg-red-50 text-red-700 border border-red-200/50";

                  return (
                    <tr key={row.id} className="align-middle hover:bg-slate-50/55 transition-colors">
                      <td className="px-5 py-3.5 font-bold text-slate-900">
                        {row.workerName}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-slate-600">{row.workerDni}</td>
                      <td className="px-5 py-3.5 text-slate-600">{row.date}</td>
                      <td className="px-5 py-3.5 text-slate-600 font-medium">
                        {shiftTypeLabels[row.shiftType] ?? row.shiftType}
                      </td>
                      <td className="px-5 py-3.5 text-slate-700 font-semibold">{formatTime(row.serverTime)}</td>
                      <td className="px-5 py-3.5 text-slate-700">{formatTime(row.checkOutTime)}</td>
                      <td className="px-5 py-3.5 text-center text-slate-700 font-mono">
                        {row.lateMinutes ? `${row.lateMinutes} min` : "-"}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${badgeStyle}`}>
                          {attendanceStatusLabels[row.status] ?? row.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-bold text-slate-900">
                        {moneyLabel(row.fineAmountCents)}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={`inline-block w-2.5 h-2.5 rounded-full ${row.toleranceUsed ? "bg-teal-500" : "bg-slate-200"}`} title={row.toleranceUsed ? "Sí" : "No"} />
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => openEditModal(row)}
                          className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-900 hover:underline transition-all active:scale-[0.97]"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          Editar
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Totals Table */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">Resumen y Totales por Trabajador</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse min-w-[700px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-600">
              <tr>
                <th className="px-5 py-4">Nombre Completo</th>
                <th className="px-5 py-4">DNI</th>
                <th className="px-5 py-4 text-center">Total Tardanzas</th>
                <th className="px-5 py-4 text-center">Total Faltas</th>
                <th className="px-5 py-4">Total Multas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td className="px-5 py-6 text-center text-slate-500" colSpan={5}>
                    Cargando resumen...
                  </td>
                </tr>
              ) : totals.length === 0 ? (
                <tr>
                  <td className="px-5 py-6 text-center text-slate-500" colSpan={5}>
                    No hay totales acumulados para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                totals.map((total) => (
                  <tr key={total.workerId} className="hover:bg-slate-55/30 transition-colors">
                    <td className="px-5 py-3.5 font-bold text-slate-900">
                      {total.workerName}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-slate-600">{total.workerDni}</td>
                    <td className="px-5 py-3.5 text-center text-slate-700 font-semibold">{total.totalLate}</td>
                    <td className="px-5 py-3.5 text-center text-slate-700 font-semibold">{total.totalAbsent}</td>
                    <td className="px-5 py-3.5 font-bold text-emerald-800">
                      {moneyLabel(total.totalFinesCents)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Edit and Override Modal */}
      {selectedRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-scale-in">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Modificar Asistencia</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedRow.workerName} ({selectedRow.workerDni}) · {selectedRow.date}
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditModal}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Tabs Selector */}
            <div className="mt-6 flex border-b border-slate-100">
              <button
                type="button"
                onClick={() => setModalTab("attendance")}
                className={`pb-3 text-sm font-semibold border-b-2 px-1 transition ${
                  modalTab === "attendance"
                    ? "border-emerald-600 text-emerald-700"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                Asistencia Marcada
              </button>
              <button
                type="button"
                onClick={() => setModalTab("schedule")}
                className={`ml-6 pb-3 text-sm font-semibold border-b-2 px-1 transition ${
                  modalTab === "schedule"
                    ? "border-emerald-600 text-emerald-700"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                Horario Especial del Día
              </button>
            </div>

            {/* Modal Content */}
            <div className="mt-6">
              {modalError && (
                <div className="mb-4 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm font-medium text-red-700 flex items-start gap-2">
                  <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                  <span>{modalError}</span>
                </div>
              )}
              {modalSuccess && (
                <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm font-medium text-emerald-700 flex items-start gap-2">
                  <CheckCircle2 className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                  <span>{modalSuccess}</span>
                </div>
              )}

              {/* Tab 1: Edit Attendance */}
              {modalTab === "attendance" && (
                <div className="space-y-4">
                  <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-3 flex gap-3 text-slate-600 text-xs">
                    <Clock className="h-4.5 w-4.5 text-emerald-600 shrink-0" />
                    <div>
                      Al modificar la hora de entrada, las tardanzas, las multas y el beneficio de la tolerancia se recalcularán cronológicamente para la semana de este trabajador.
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <label className="block">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Entrada (HH:MM)</span>
                      <input
                        type="time"
                        value={editCheckIn}
                        onChange={(e) => setEditCheckIn(e.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100/50"
                      />
                    </label>

                    <label className="block">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Salida (HH:MM)</span>
                      <input
                        type="time"
                        value={editCheckOut}
                        onChange={(e) => setEditCheckOut(e.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100/50"
                        placeholder="Sin marcar"
                      />
                    </label>
                  </div>

                  {/* Audit Info Collapsible */}
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Información de Auditoría</h4>
                    <div className="space-y-2 rounded-xl bg-slate-50/60 border border-slate-100 p-3 text-xs text-slate-600 font-mono">
                      <div>
                        <span className="font-semibold text-slate-700">Entrada Device:</span>
                        <div className="pl-3 mt-1 space-y-0.5">
                          <div><span className="text-slate-400">Huella:</span> {selectedRow.deviceFingerprint || "N/D"}</div>
                          <div><span className="text-slate-400">IP:</span> {selectedRow.ipAddress || "N/D"}</div>
                          <div className="truncate" title={selectedRow.userAgent || ""}><span className="text-slate-400">Navegador:</span> {selectedRow.userAgent || "N/D"}</div>
                        </div>
                      </div>
                      <div className="border-t border-slate-100 pt-2 mt-2">
                        <span className="font-semibold text-slate-700">Salida Device:</span>
                        <div className="pl-3 mt-1 space-y-0.5">
                          <div><span className="text-slate-400">Huella:</span> {selectedRow.checkOutFingerprint || "N/D"}</div>
                          <div><span className="text-slate-400">IP:</span> {selectedRow.checkOutIp || "N/D"}</div>
                          <div className="truncate" title={selectedRow.checkOutUserAgent || ""}><span className="text-slate-400">Navegador:</span> {selectedRow.checkOutUserAgent || "N/D"}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
                    <button
                      type="button"
                      onClick={closeEditModal}
                      className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 active:scale-[0.98]"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveAttendance}
                      disabled={modalSaving || !editCheckIn}
                      className="rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-emerald-800 disabled:opacity-50 active:scale-[0.98]"
                    >
                      {modalSaving ? "Guardando..." : "Guardar Cambios"}
                    </button>
                  </div>
                </div>
              )}

              {/* Tab 2: Daily overrides */}
              {modalTab === "schedule" && (
                <div className="space-y-4">
                  <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-3 flex gap-3 text-slate-600 text-xs">
                    <Info className="h-4.5 w-4.5 text-blue-600 shrink-0" />
                    <div>
                      Configura un horario especial aplicable **exclusivamente a esta fecha** para este trabajador. Esto anula las reglas regulares semanales/globales por hoy.
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <label className="block">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Entrada Mañana</span>
                      <input
                        type="time"
                        value={overrideForm.morningEntryTime}
                        onChange={(e) => setOverrideForm(prev => ({ ...prev, morningEntryTime: e.target.value }))}
                        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100/50"
                      />
                    </label>

                    <label className="block">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Salida Mañana</span>
                      <input
                        type="time"
                        value={overrideForm.morningExitTime}
                        onChange={(e) => setOverrideForm(prev => ({ ...prev, morningExitTime: e.target.value }))}
                        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100/50"
                      />
                    </label>

                    <label className="block">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Entrada Tarde</span>
                      <input
                        type="time"
                        value={overrideForm.afternoonEntryTime}
                        onChange={(e) => setOverrideForm(prev => ({ ...prev, afternoonEntryTime: e.target.value }))}
                        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100/50"
                      />
                    </label>

                    <label className="block">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Salida Tarde</span>
                      <input
                        type="time"
                        value={overrideForm.afternoonExitTime}
                        onChange={(e) => setOverrideForm(prev => ({ ...prev, afternoonExitTime: e.target.value }))}
                        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100/50"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-4 items-end">
                    <label className="block">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tolerancia (Minutos)</span>
                      <input
                        type="number"
                        min={0}
                        value={overrideForm.toleranceMinutes}
                        onChange={(e) => setOverrideForm(prev => ({ ...prev, toleranceMinutes: Number(e.target.value) }))}
                        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100/50"
                      />
                    </label>

                    {hasOverride && (
                      <button
                        type="button"
                        onClick={handleDeleteOverride}
                        disabled={modalSaving}
                        className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700 hover:bg-red-100 transition active:scale-[0.98]"
                      >
                        <Trash2 className="h-4 w-4" />
                        Eliminar Horario Especial
                      </button>
                    )}
                  </div>

                  <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
                    <button
                      type="button"
                      onClick={closeEditModal}
                      className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 active:scale-[0.98]"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveOverride}
                      disabled={
                        modalSaving ||
                        (!overrideForm.morningEntryTime &&
                          !overrideForm.morningExitTime &&
                          !overrideForm.afternoonEntryTime &&
                          !overrideForm.afternoonExitTime)
                      }
                      className="rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-emerald-800 disabled:opacity-50 active:scale-[0.98]"
                    >
                      {modalSaving ? "Guardando..." : "Guardar Horario Especial"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Attendance Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-scale-in">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Registrar Nueva Asistencia</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Ingresa manualmente una marcación de entrada y salida para un trabajador.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="mt-6 space-y-4">
              {createError && (
                <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm font-medium text-red-700 flex items-start gap-2">
                  <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                  <span>{createError}</span>
                </div>
              )}
              {createSuccess && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm font-medium text-emerald-700 flex items-start gap-2">
                  <CheckCircle2 className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                  <span>{createSuccess}</span>
                </div>
              )}

              <label className="block">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Trabajador</span>
                <select
                  value={createWorkerId}
                  onChange={(e) => setCreateWorkerId(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100/50"
                >
                  <option value="">Selecciona un trabajador...</option>
                  {workers.map((worker) => (
                    <option key={worker.id} value={worker.id}>
                      {worker.fullName}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha</span>
                  <input
                    type="date"
                    value={createDate}
                    onChange={(e) => setCreateDate(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100/50"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Turno</span>
                  <select
                    value={createShiftType}
                    onChange={(e) => setCreateShiftType(e.target.value as "morning" | "afternoon")}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100/50"
                  >
                    <option value="morning">Mañana</option>
                    <option value="afternoon">Tarde</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Entrada (HH:MM)</span>
                  <input
                    type="time"
                    value={createCheckIn}
                    onChange={(e) => setCreateCheckIn(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100/50"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Salida (HH:MM)</span>
                  <input
                    type="time"
                    value={createCheckOut}
                    onChange={(e) => setCreateCheckOut(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100/50"
                    placeholder="Sin marcar"
                  />
                </label>
              </div>

              <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 active:scale-[0.98]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCreateAttendance}
                  disabled={createSaving || !createWorkerId || !createDate || !createCheckIn}
                  className="rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-emerald-800 disabled:opacity-50 active:scale-[0.98]"
                >
                  {createSaving ? "Registrando..." : "Registrar Asistencia"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
