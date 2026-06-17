import { requireAdminSession } from "@/lib/auth";
import {
  formatReportFineLabel,
  getAttendanceReportRows,
  getWorkerAttendanceTotals
} from "@/lib/data";
import { formatTimeOnly } from "@/lib/dates";
import { jsonError } from "@/lib/http";
import { attendanceStatusLabels, shiftTypeLabels } from "@/lib/labels";

type CellValue = string | number | null | undefined;

function escapeHtml(value: CellValue) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toXls(title: string, headers: string[], rows: CellValue[][]) {
  const head = headers
    .map((header) => `<th>${escapeHtml(header)}</th>`)
    .join("");
  const body = rows
    .map(
      (row) =>
        `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`
    )
    .join("");

  return `<h2>${escapeHtml(title)}</h2>
<table>
  <thead><tr>${head}</tr></thead>
  <tbody>${body}</tbody>
</table>`;
}

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

  const detailTable = toXls(
    "Detalle por turno",
    [
      "Nombre completo",
      "DNI",
      "Fecha",
      "Turno",
      "Entrada",
      "Salida",
      "Minutos de retraso",
      "Estado",
      "Multa aplicada",
      "Tolerancia utilizada",
      "Distancia (m)"
    ],
    rows.map((row) => [
      row.workerName,
      row.workerDni,
      row.date,
      shiftTypeLabels[row.shiftType] ?? row.shiftType,
      formatTimeOnly(row.serverTime),
      formatTimeOnly(row.checkOutTime),
      row.lateMinutes,
      attendanceStatusLabels[row.status] ?? row.status,
      formatReportFineLabel(row.fineAmountCents),
      row.toleranceUsed ? "Si" : "No",
      Math.round(row.distanceMeters)
    ])
  );

  const totalsTable = toXls(
    "Totales por trabajador",
    ["Nombre completo", "DNI", "Total tardanzas", "Total faltas", "Total multas"],
    totals.map((total) => [
      total.workerName,
      total.workerDni,
      total.totalLate,
      total.totalAbsent,
      `S/. ${(total.totalFinesCents / 100).toFixed(2)}`
    ])
  );

  const xls = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 12px; margin-bottom: 24px; }
      th { background: #e2e8f0; font-weight: bold; }
      th, td { border: 1px solid #94a3b8; padding: 6px 8px; white-space: nowrap; }
      h2 { font-family: Arial, sans-serif; font-size: 14px; }
    </style>
  </head>
  <body>
    ${detailTable}
    ${totalsTable}
  </body>
</html>`;

  return new Response(xls, {
    headers: {
      "content-type": "application/vnd.ms-excel; charset=utf-8",
      "content-disposition": `attachment; filename="reporte-asistencia.xls"`
    }
  });
}
