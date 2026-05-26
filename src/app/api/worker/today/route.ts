import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { attendanceRecords } from "@/db/schema";
import { getBusinessDate, getBusinessTime } from "@/lib/dates";
import { jsonError } from "@/lib/http";
import { getWorkerFromRequest } from "@/lib/worker-auth";

export async function GET(request: Request) {
  const worker = await getWorkerFromRequest(request);
  if (!worker) {
    return jsonError("Token invalido o trabajador inactivo.", 401);
  }

  const today = getBusinessDate();
  const [record] = await db
    .select()
    .from(attendanceRecords)
    .where(and(eq(attendanceRecords.workerId, worker.id), eq(attendanceRecords.date, today)))
    .limit(1);

  const nextAction = !record?.checkInTime
    ? "check_in"
    : record.checkOutTime
      ? "complete"
      : "check_out";

  return NextResponse.json({
    date: today,
    serverTime: getBusinessTime(),
    nextAction,
    record: record ?? null
  });
}
