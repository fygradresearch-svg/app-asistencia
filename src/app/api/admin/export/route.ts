import { requireAdminSession } from "@/lib/auth";
import { getAttendanceReportRows } from "@/lib/data";
import { formatTimeOnly } from "@/lib/dates";
import { jsonError } from "@/lib/http";

type CellValue = string | number | null | undefined;

function escapeHtml(value: CellValue) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toXls(headers: string[], rows: CellValue[][]) {
  const head = headers
    .map((header) => `<th>${escapeHtml(header)}</th>`)
    .join("");
  const body = rows
    .map(
      (row) =>
        `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`
    )
    .join("");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 12px; }
      th { background: #e2e8f0; font-weight: bold; }
      th, td { border: 1px solid #94a3b8; padding: 6px 8px; white-space: nowrap; }
    </style>
  </head>
  <body>
    <table>
      <thead><tr>${head}</tr></thead>
      <tbody>${body}</tbody>
    </table>
  </body>
</html>`;
}

export async function GET(request: Request) {
  const session = await requireAdminSession();
  if (!session) {
    return jsonError("No autorizado.", 401);
  }

  const url = new URL(request.url);
  const workerIdValue = url.searchParams.get("workerId");
  const workerId = workerIdValue ? Number(workerIdValue) : null;

  const rows = await getAttendanceReportRows({
    date: url.searchParams.get("date"),
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
    workerId: Number.isInteger(workerId) ? workerId : null
  });

  const xls = toXls(
    [
      "Nombre completo",
      "Fecha",
      "Entrada manana",
      "Salida manana",
      "Multa manana",
      "Entrada tarde",
      "Salida tarde",
      "Multa tarde",
      "Total multas",
      "Estado de asistencia",
      "Estado GPS"
    ],
    rows.map((row) => [
      row.workerName,
      row.date,
      formatTimeOnly(row.checkInTime),
      formatTimeOnly(row.checkOutTime),
      row.penaltyLabel,
      formatTimeOnly(row.afternoonCheckInTime),
      formatTimeOnly(row.afternoonCheckOutTime),
      row.afternoonPenaltyLabel,
      `S/. ${(row.totalFineAmountCents / 100).toFixed(2)}`,
      row.attendanceStatus,
      row.gpsStatus
    ])
  );

  return new Response(xls, {
    headers: {
      "content-type": "application/vnd.ms-excel; charset=utf-8",
      "content-disposition": `attachment; filename="reporte-asistencia.xls"`
    }
  });
}
