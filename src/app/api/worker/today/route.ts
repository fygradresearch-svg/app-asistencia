import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { attendanceRecords } from "@/db/schema";
import { getBusinessDate, getBusinessTime, minutesFromTime } from "@/lib/dates";
import { jsonError } from "@/lib/http";
import { getWorkerFromRequest } from "@/lib/worker-auth";

const AFTERNOON_ENTRY_TIME = "15:00";

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

  const currentMinutes = minutesFromTime(getBusinessTime().slice(0, 5));
  const isAfternoon = currentMinutes >= minutesFromTime(AFTERNOON_ENTRY_TIME);
  const nextAction = (() => {
    if (!record) {
      return isAfternoon ? "check_in" : "check_in";
    }

    if (record.afternoonCheckInTime && !record.afternoonCheckOutTime) {
      return "check_out";
    }

    if (record.checkInTime && !record.checkOutTime && !isAfternoon) {
      return "check_out";
    }

    if (!isAfternoon && record.checkInTime && record.checkOutTime && !record.afternoonCheckInTime) {
      return "waiting_afternoon";
    }

    if (isAfternoon && !record.afternoonCheckInTime) {
      return "check_in";
    }

    if (!record.checkInTime) {
      return "check_in";
    }

    if (record.checkInTime && !record.checkOutTime) {
      return "check_out";
    }

    return "complete";
  })();

  const activeShift = isAfternoon ? "afternoon" : "morning";

  return NextResponse.json({
    date: today,
    serverTime: getBusinessTime(),
    activeShift,
    nextAction,
    record: record ?? null
  });
}
