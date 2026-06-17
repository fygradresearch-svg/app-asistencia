import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import { getAttendanceReportRows, getWorkerAttendanceTotals } from "@/lib/data";
import { jsonError } from "@/lib/http";

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

  return NextResponse.json({ rows, totals });
}
