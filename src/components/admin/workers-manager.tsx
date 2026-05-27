"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  Clock,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2,
  UserCheck,
  UserX,
  X
} from "lucide-react";
import { codeUsedLabels, workerStatusLabels } from "@/lib/labels";

type WorkerDaySchedule = {
  id?: number;
  workerId?: number;
  weekday: number;
  entryTime: string;
  exitTime: string;
  morningEntryTime: string | null;
  morningExitTime: string | null;
  afternoonEntryTime: string | null;
  afternoonExitTime: string | null;
  toleranceMinutes: number;
};

type WorkerRow = {
  id: number;
  fullName: string;
  activationCode: string;
  codeUsed: boolean;
  status: "pending" | "active" | "inactive";
  scheduleEntryTime: string | null;
  scheduleExitTime: string | null;
  scheduleToleranceMinutes: number | null;
  daySchedules?: WorkerDaySchedule[];
  createdAt: string;
  activatedAt: string | null;
};

type DayScheduleForm = {
  weekday: number;
  label: string;
  enabled: boolean;
  morningEntryTime: string;
  morningExitTime: string;
  afternoonEntryTime: string;
  afternoonExitTime: string;
  toleranceMinutes: string;
};

type WorkerScheduleForm = {
  useCustomSchedule: boolean;
  days: DayScheduleForm[];
};

const weekdays = [
  { weekday: 1, label: "Lunes", shortLabel: "Lun" },
  { weekday: 2, label: "Martes", shortLabel: "Mar" },
  { weekday: 3, label: "Miercoles", shortLabel: "Mie" },
  { weekday: 4, label: "Jueves", shortLabel: "Jue" },
  { weekday: 5, label: "Viernes", shortLabel: "Vie" }
];

function defaultScheduleForm(enabled = false): WorkerScheduleForm {
  return {
    useCustomSchedule: enabled,
    days: weekdays.map((day) => ({
      weekday: day.weekday,
      label: day.label,
      enabled,
      morningEntryTime: "09:00",
      morningExitTime: "13:00",
      afternoonEntryTime: "15:00",
      afternoonExitTime: "19:00",
      toleranceMinutes: "10"
    }))
  };
}

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function statusBadge(status: WorkerRow["status"]) {
  const styles = {
    pending: "bg-amber-50 text-amber-800",
    active: "bg-emerald-50 text-emerald-800",
    inactive: "bg-slate-100 text-slate-700"
  };
  return (
    <span className={`rounded-md px-2 py-1 text-xs font-semibold ${styles[status]}`}>
      {workerStatusLabels[status]}
    </span>
  );
}

function timeLabel(value: string | null) {
  return value ? value.slice(0, 5) : "";
}

function hasLegacyCustomSchedule(worker: WorkerRow) {
  return Boolean(
    worker.scheduleEntryTime &&
      worker.scheduleExitTime &&
      worker.scheduleToleranceMinutes !== null
  );
}

function scheduleLabel(worker: WorkerRow) {
  const daySchedules = worker.daySchedules ?? [];

  if (daySchedules.length) {
    const allSame =
      daySchedules.length === 5 &&
      daySchedules.every(
        (schedule) =>
          schedule.entryTime === daySchedules[0].entryTime &&
          schedule.exitTime === daySchedules[0].exitTime &&
          schedule.morningExitTime === daySchedules[0].morningExitTime &&
          schedule.afternoonEntryTime === daySchedules[0].afternoonEntryTime &&
          schedule.toleranceMinutes === daySchedules[0].toleranceMinutes
      );

    if (allSame) {
      const schedule = daySchedules[0];
      return `Lun-Vie ${timeLabel(schedule.morningEntryTime ?? schedule.entryTime)}-${timeLabel(schedule.morningExitTime ?? "13:00")} / ${timeLabel(schedule.afternoonEntryTime ?? "15:00")}-${timeLabel(schedule.afternoonExitTime ?? schedule.exitTime)} (${schedule.toleranceMinutes} min)`;
    }

    const labels = daySchedules
      .map((schedule) => weekdays.find((day) => day.weekday === schedule.weekday)?.shortLabel)
      .filter(Boolean)
      .join(", ");

    return `${labels}: personalizado`;
  }

  if (hasLegacyCustomSchedule(worker)) {
    return `${timeLabel(worker.scheduleEntryTime)} - ${timeLabel(worker.scheduleExitTime)} (${worker.scheduleToleranceMinutes} min)`;
  }

  return "General";
}

function scheduleFormFromWorker(worker: WorkerRow): WorkerScheduleForm {
  const form = defaultScheduleForm(false);
  const daySchedules = worker.daySchedules ?? [];

  if (daySchedules.length) {
    return {
      useCustomSchedule: true,
      days: form.days.map((day) => {
        const schedule = daySchedules.find((item) => item.weekday === day.weekday);
        return {
          ...day,
          enabled: Boolean(schedule),
          morningEntryTime:
            timeLabel(schedule?.morningEntryTime ?? schedule?.entryTime ?? null) ||
            day.morningEntryTime,
          morningExitTime:
            timeLabel(schedule?.morningExitTime ?? null) || day.morningExitTime,
          afternoonEntryTime:
            timeLabel(schedule?.afternoonEntryTime ?? null) || day.afternoonEntryTime,
          afternoonExitTime:
            timeLabel(schedule?.afternoonExitTime ?? schedule?.exitTime ?? null) ||
            day.afternoonExitTime,
          toleranceMinutes: String(schedule?.toleranceMinutes ?? day.toleranceMinutes)
        };
      })
    };
  }

  if (hasLegacyCustomSchedule(worker)) {
    return {
      useCustomSchedule: true,
      days: form.days.map((day) => ({
        ...day,
        enabled: true,
        morningEntryTime: timeLabel(worker.scheduleEntryTime) || day.morningEntryTime,
        morningExitTime: day.morningExitTime,
        afternoonEntryTime: day.afternoonEntryTime,
        afternoonExitTime: timeLabel(worker.scheduleExitTime) || day.afternoonExitTime,
        toleranceMinutes: String(worker.scheduleToleranceMinutes ?? 10)
      }))
    };
  }

  return form;
}

function serializeDaySchedules(form: WorkerScheduleForm) {
  if (!form.useCustomSchedule) {
    return [];
  }

  return form.days
    .filter((day) => day.enabled)
    .map((day) => ({
      weekday: day.weekday,
      entryTime: day.morningEntryTime,
      exitTime: day.afternoonExitTime,
      morningEntryTime: day.morningEntryTime,
      morningExitTime: day.morningExitTime,
      afternoonEntryTime: day.afternoonEntryTime,
      afternoonExitTime: day.afternoonExitTime,
      toleranceMinutes: day.toleranceMinutes
    }));
}

function ScheduleDaysEditor({
  form,
  onChange
}: {
  form: WorkerScheduleForm;
  onChange: (form: WorkerScheduleForm) => void;
}) {
  function updateDay(weekday: number, changes: Partial<DayScheduleForm>) {
    onChange({
      ...form,
      days: form.days.map((day) =>
        day.weekday === weekday ? { ...day, ...changes } : day
      )
    });
  }

  return (
    <div className="space-y-3">
      {form.days.map((day) => (
        <div
          key={day.weekday}
          className="grid gap-3 rounded-md border border-slate-200 p-3 md:grid-cols-[120px_1fr_1fr_1fr_1fr_1fr]"
        >
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={day.enabled}
              onChange={(event) => updateDay(day.weekday, { enabled: event.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-500"
            />
            {day.label}
          </label>
          <label>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Entrada AM
            </span>
            <input
              type="time"
              value={day.morningEntryTime}
              onChange={(event) =>
                updateDay(day.weekday, { morningEntryTime: event.target.value })
              }
              disabled={!day.enabled}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100 disabled:text-slate-400"
            />
          </label>
          <label>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Salida AM
            </span>
            <input
              type="time"
              value={day.morningExitTime}
              onChange={(event) =>
                updateDay(day.weekday, { morningExitTime: event.target.value })
              }
              disabled={!day.enabled}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100 disabled:text-slate-400"
            />
          </label>
          <label>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Entrada PM
            </span>
            <input
              type="time"
              value={day.afternoonEntryTime}
              onChange={(event) =>
                updateDay(day.weekday, { afternoonEntryTime: event.target.value })
              }
              disabled={!day.enabled}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100 disabled:text-slate-400"
            />
          </label>
          <label>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Salida PM
            </span>
            <input
              type="time"
              value={day.afternoonExitTime}
              onChange={(event) =>
                updateDay(day.weekday, { afternoonExitTime: event.target.value })
              }
              disabled={!day.enabled}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100 disabled:text-slate-400"
            />
          </label>
          <label>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Tolerancia
            </span>
            <input
              value={day.toleranceMinutes}
              onChange={(event) =>
                updateDay(day.weekday, { toleranceMinutes: event.target.value })
              }
              disabled={!day.enabled}
              inputMode="numeric"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100 disabled:text-slate-400"
            />
          </label>
        </div>
      ))}
    </div>
  );
}

export function WorkersManager() {
  const [workers, setWorkers] = useState<WorkerRow[]>([]);
  const [fullName, setFullName] = useState("");
  const [createSchedule, setCreateSchedule] = useState<WorkerScheduleForm>(
    defaultScheduleForm(false)
  );
  const [editingWorker, setEditingWorker] = useState<WorkerRow | null>(null);
  const [scheduleForm, setScheduleForm] = useState<WorkerScheduleForm>(
    defaultScheduleForm(false)
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadWorkers() {
    setLoading(true);
    const response = await fetch("/api/admin/workers");
    const data = await response.json().catch(() => []);
    setLoading(false);

    if (response.ok) {
      setWorkers(data);
    }
  }

  useEffect(() => {
    void loadWorkers();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    const response = await fetch("/api/admin/workers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fullName,
        ...(createSchedule.useCustomSchedule
          ? { daySchedules: serializeDaySchedules(createSchedule) }
          : {})
      })
    });
    const data = await response.json().catch(() => ({}));
    setSaving(false);

    if (!response.ok) {
      setError(data.error ?? "No se pudo registrar el trabajador.");
      return;
    }

    setFullName("");
    setCreateSchedule(defaultScheduleForm(false));
    setMessage(`Trabajador registrado. Codigo: ${data.activationCode}`);
    await loadWorkers();
  }

  async function updateStatus(worker: WorkerRow, status: "active" | "inactive") {
    setError("");
    const response = await fetch(`/api/admin/workers/${worker.id}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status })
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(data.error ?? "No se pudo actualizar el trabajador.");
      return;
    }

    await loadWorkers();
  }

  async function regenerate(worker: WorkerRow) {
    setError("");
    const response = await fetch(`/api/admin/workers/${worker.id}/regenerate-code`, {
      method: "POST"
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(data.error ?? "No se pudo regenerar el codigo.");
      return;
    }

    setMessage(`Nuevo codigo para ${worker.fullName}: ${data.activationCode}`);
    await loadWorkers();
  }

  async function remove(worker: WorkerRow) {
    if (!confirm(`Eliminar a ${worker.fullName}?`)) {
      return;
    }

    setError("");
    const response = await fetch(`/api/admin/workers/${worker.id}`, {
      method: "DELETE"
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(data.error ?? "No se pudo eliminar el trabajador.");
      return;
    }

    await loadWorkers();
  }

  function openScheduleModal(worker: WorkerRow) {
    setEditingWorker(worker);
    setScheduleForm(scheduleFormFromWorker(worker));
  }

  async function saveWorkerSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingWorker) {
      return;
    }

    setSavingSchedule(true);
    setError("");
    setMessage("");

    const response = await fetch(`/api/admin/workers/${editingWorker.id}/schedule`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ daySchedules: serializeDaySchedules(scheduleForm) })
    });
    const data = await response.json().catch(() => ({}));
    setSavingSchedule(false);

    if (!response.ok) {
      setError(data.error ?? "No se pudo guardar el horario del trabajador.");
      return;
    }

    setMessage(`Horario actualizado para ${editingWorker.fullName}.`);
    setEditingWorker(null);
    await loadWorkers();
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            Panel administrador
          </p>
          <h1 className="mt-1 text-3xl font-bold text-slate-950">Trabajadores</h1>
        </div>
        <button
          type="button"
          onClick={loadWorkers}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Actualizar
        </button>
      </div>

      <section className="mb-6 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <form onSubmit={submit} className="grid gap-4 lg:grid-cols-[1fr_auto]">
          <label>
            <span className="text-sm font-medium text-slate-700">Nombre completo</span>
            <input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              placeholder="Juan Perez"
            />
          </label>
          <div className="lg:self-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2 font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-60 lg:w-auto"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {saving ? "Guardando..." : "Registrar"}
            </button>
          </div>

          <div className="lg:col-span-2">
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={createSchedule.useCustomSchedule}
                onChange={(event) =>
                  setCreateSchedule(
                    event.target.checked
                      ? defaultScheduleForm(true)
                      : defaultScheduleForm(false)
                  )
                }
                className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-500"
              />
              Horario personalizado por dias
            </label>
          </div>

          {createSchedule.useCustomSchedule ? (
            <div className="lg:col-span-2">
              <ScheduleDaysEditor form={createSchedule} onChange={setCreateSchedule} />
            </div>
          ) : null}
        </form>
      </section>

      {message ? (
        <p className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
          {message}
        </p>
      ) : null}

      {error ? (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          {error}
        </p>
      ) : null}

      <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1120px] w-full text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Nombre completo</th>
                <th className="px-4 py-3">Codigo</th>
                <th className="px-4 py-3">Estado codigo</th>
                <th className="px-4 py-3">Usuario</th>
                <th className="px-4 py-3">Horario</th>
                <th className="px-4 py-3">Creacion</th>
                <th className="px-4 py-3">Activacion</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td className="px-4 py-5 text-slate-500" colSpan={9}>
                    Cargando...
                  </td>
                </tr>
              ) : workers.length === 0 ? (
                <tr>
                  <td className="px-4 py-5 text-slate-500" colSpan={9}>
                    No hay trabajadores registrados.
                  </td>
                </tr>
              ) : (
                workers.map((worker) => (
                  <tr key={worker.id} className="align-top">
                    <td className="px-4 py-3 font-medium text-slate-700">{worker.id}</td>
                    <td className="px-4 py-3 font-semibold text-slate-950">
                      {worker.fullName}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-slate-900 px-2 py-1 font-mono text-sm font-bold text-white">
                        {worker.activationCode}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {codeUsedLabels[String(worker.codeUsed)]}
                    </td>
                    <td className="px-4 py-3">{statusBadge(worker.status)}</td>
                    <td className="px-4 py-3 text-slate-700">{scheduleLabel(worker)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(worker.createdAt)}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatDate(worker.activatedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {worker.status === "inactive" ? (
                          <button
                            type="button"
                            onClick={() => updateStatus(worker, "active")}
                            className="rounded-md border border-emerald-200 p-2 text-emerald-700 transition hover:bg-emerald-50"
                            aria-label="Reactivar usuario"
                            title="Reactivar usuario"
                          >
                            <UserCheck className="h-4 w-4" aria-hidden="true" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => updateStatus(worker, "inactive")}
                            className="rounded-md border border-slate-200 p-2 text-slate-700 transition hover:bg-slate-100"
                            aria-label="Desactivar usuario"
                            title="Desactivar usuario"
                          >
                            <UserX className="h-4 w-4" aria-hidden="true" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => regenerate(worker)}
                          className="rounded-md border border-blue-200 p-2 text-blue-700 transition hover:bg-blue-50"
                          aria-label="Regenerar codigo"
                          title="Regenerar codigo"
                        >
                          <RotateCcw className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openScheduleModal(worker)}
                          className="rounded-md border border-amber-200 p-2 text-amber-700 transition hover:bg-amber-50"
                          aria-label="Editar horario"
                          title="Editar horario"
                        >
                          <Clock className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(worker)}
                          className="rounded-md border border-red-200 p-2 text-red-700 transition hover:bg-red-50"
                          aria-label="Eliminar usuario"
                          title="Eliminar usuario"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {editingWorker ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
          <section className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-md border border-slate-200 bg-white p-5 shadow-soft">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
                  Horario personalizado
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-950">
                  {editingWorker.fullName}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setEditingWorker(null)}
                className="rounded-md border border-slate-200 p-2 text-slate-700 transition hover:bg-slate-100"
                aria-label="Cerrar"
                title="Cerrar"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={saveWorkerSchedule} className="space-y-4">
              <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={scheduleForm.useCustomSchedule}
                  onChange={(event) => {
                    if (!event.target.checked) {
                      setScheduleForm(defaultScheduleForm(false));
                      return;
                    }
                    const base = scheduleFormFromWorker(editingWorker);
                    setScheduleForm(base.useCustomSchedule ? base : defaultScheduleForm(true));
                  }}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-500"
                />
                Usar horario personalizado de lunes a viernes
              </label>

              {scheduleForm.useCustomSchedule ? (
                <ScheduleDaysEditor form={scheduleForm} onChange={setScheduleForm} />
              ) : null}

              <button
                type="submit"
                disabled={savingSchedule}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-3 font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-60 sm:w-auto"
              >
                <Save className="h-4 w-4" aria-hidden="true" />
                {savingSchedule ? "Guardando..." : "Guardar horario"}
              </button>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
