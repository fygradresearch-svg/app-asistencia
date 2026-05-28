import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { attendanceRecords } from "@/db/schema";
import { getBusinessDate, getBusinessTime, minutesFromTime } from "@/lib/dates";
import { jsonError } from "@/lib/http";
import { getWorkerFromRequest } from "@/lib/worker-auth";
import {
  getScheduleForWorker,
  getShiftForCheckIn,
  hasShift,
  type DayShiftSchedule,
  type ShiftName
} from "@/lib/worker-schedules";

function getNextAction(
  record: typeof attendanceRecords.$inferSelect | undefined,
  now: Date,
  schedule: DayShiftSchedule
): {
  activeShift: ShiftName | null;
  nextAction: "check_in" | "check_out" | "waiting_afternoon" | "complete" | "no_schedule";
} {
  const hasMorning = hasShift(schedule, "morning");
  const hasAfternoon = hasShift(schedule, "afternoon");

  if (!hasMorning && !hasAfternoon) {
    return { activeShift: null, nextAction: "no_schedule" };
  }

  if (hasMorning && record?.checkInTime && !record.checkOutTime) {
    return { activeShift: "morning", nextAction: "check_out" };
  }

  if (hasAfternoon && record?.afternoonCheckInTime && !record.afternoonCheckOutTime) {
    return { activeShift: "afternoon", nextAction: "check_out" };
  }

  if (hasMorning && !record?.checkInTime) {
    if (!hasAfternoon || !schedule.afternoonEntryTime) {
      return { activeShift: "morning", nextAction: "check_in" };
    }

    const currentMinutes = minutesFromTime(getBusinessTime(now).slice(0, 5));
    const afternoonMinutes = minutesFromTime(schedule.afternoonEntryTime);
    if (currentMinutes < afternoonMinutes) {
      return { activeShift: "morning", nextAction: "check_in" };
    }
  }

  if (
    hasMorning &&
    hasAfternoon &&
    record?.checkInTime &&
    record.checkOutTime &&
    !record.afternoonCheckInTime &&
    schedule.afternoonEntryTime
  ) {
    const currentMinutes = minutesFromTime(getBusinessTime(now).slice(0, 5));
    const afternoonMinutes = minutesFromTime(schedule.afternoonEntryTime);
    if (currentMinutes < afternoonMinutes) {
      return { activeShift: "afternoon", nextAction: "waiting_afternoon" };
    }
  }

  if (hasAfternoon && !record?.afternoonCheckInTime) {
    return { activeShift: "afternoon", nextAction: "check_in" };
  }

  return { activeShift: getShiftForCheckIn(now, schedule), nextAction: "complete" };
}

export async function GET(request: Request) {
  const worker = await getWorkerFromRequest(request);
  if (!worker) {
    return jsonError("Token invalido o trabajador inactivo.", 401);
  }

  const today = getBusinessDate();
  const now = new Date();
  const schedule = await getScheduleForWorker(worker, now);
  const [record] = await db
    .select()
    .from(attendanceRecords)
    .where(and(eq(attendanceRecords.workerId, worker.id), eq(attendanceRecords.date, today)))
    .limit(1);

  const { activeShift, nextAction } = schedule
    ? getNextAction(record, now, schedule)
    : { activeShift: null, nextAction: "no_schedule" as const };

  return NextResponse.json({
    date: today,
    serverTime: getBusinessTime(),
    activeShift,
    nextAction,
    record: record ?? null
  });
}
