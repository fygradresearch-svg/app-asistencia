import { requireAdminSession } from "@/lib/auth";
import {
  formatReportFineLabel,
  getAttendanceReportRows,
  getWorkerAttendanceTotals
} from "@/lib/data";
import { formatTimeOnly } from "@/lib/dates";
import { jsonError } from "@/lib/http";
import { attendanceStatusLabels, shiftTypeLabels } from "@/lib/labels";
import { createWorkbookBuffer } from "@/lib/xlsx";

type CellValue = string | number | null | undefined;

export async function GET(request: Request) {
  const session = await requireAdminSession();
  if (!session) {
    return jsonError("No autorizado.", 401);
  }

  const url = new URL(request.url);
  const workerIdValue = url.searchParams.get("workerId");
  const workerId = workerIdValue ? Number(workerIdValue) : null;
  const filters = {
    date: url.searchParams.get("date"),
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
    workerId: Number.isInteger(workerId) ? workerId : null
  };

  const [rows, totals] = await Promise.all([
    getAttendanceReportRows(filters),
    getWorkerAttendanceTotals(filters)
  ]);

  const detailHeaders = [
    "Nombre completo",
    "DNI",
    "Fecha",
    "Turno",
    "Hora programada",
    "Entrada",
    "Salida",
    "Minutos de retraso",
    "Estado",
    "Falto turno",
    "Multa aplicada",
    "Tolerancia utilizada",
    "Distancia (m)"
  ];

  const detailRows = rows.map((row) => [
    row.workerName,
    row.workerDni,
    row.date,
    shiftTypeLabels[row.shiftType] ?? row.shiftType,
    row.scheduledEntryTime?.slice(0, 5) ?? "",
    formatTimeOnly(row.serverTime),
    formatTimeOnly(row.checkOutTime),
    row.lateMinutes,
    attendanceStatusLabels[row.status] ?? row.status,
    row.status === "absent" ? "Si" : "No",
    formatReportFineLabel(row.fineAmountCents),
    row.toleranceUsed ? "Si" : "No",
    Math.round(row.distanceMeters)
  ]);

  const totalHeaders = [
    "Nombre completo",
    "DNI",
    "Total tardanzas",
    "Total faltas",
    "Total multas"
  ];

  const totalRows = totals.map((total) => [
    total.workerName,
    total.workerDni,
    total.totalLate,
    total.totalAbsent,
    `S/. ${(total.totalFinesCents / 100).toFixed(2)}`
  ]);

  const workbook = createWorkbookBuffer([
    {
      name: "Detalle por turno",
      rows: [detailHeaders, ...detailRows] satisfies CellValue[][]
    },
    {
      name: "Totales por trabajador",
      rows: [totalHeaders, ...totalRows] satisfies CellValue[][]
    }
  ]);

  return new Response(workbook, {
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="reporte-asistencia.xlsx"`
    }
  });
}
