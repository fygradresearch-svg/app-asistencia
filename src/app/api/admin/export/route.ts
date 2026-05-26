import { requireAdminSession } from "@/lib/auth";
import { getAttendanceReportRows } from "@/lib/data";
import { formatTimeOnly } from "@/lib/dates";
import { jsonError } from "@/lib/http";
import { toCsv } from "@/lib/csv";

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

  const csv = toCsv(
    [
      "Nombre completo",
      "Fecha",
      "Hora de entrada",
      "Hora de salida",
      "Estado de asistencia",
      "Distancia GPS entrada",
      "Distancia GPS salida",
      "Estado GPS",
      "Latitud entrada",
      "Longitud entrada",
      "Latitud salida",
      "Longitud salida"
    ],
    rows.map((row) => [
      row.workerName,
      row.date,
      formatTimeOnly(row.checkInTime),
      formatTimeOnly(row.checkOutTime),
      row.attendanceStatus,
      row.checkInDistanceMeters?.toFixed(2),
      row.checkOutDistanceMeters?.toFixed(2),
      row.gpsStatus,
      row.checkInLatitude,
      row.checkInLongitude,
      row.checkOutLatitude,
      row.checkOutLongitude
    ])
  );

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="reporte-asistencia.csv"`
    }
  });
}
