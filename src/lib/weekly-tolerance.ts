import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { shiftAttendanceRecords } from "@/db/schema";
import { getWeekEndDate, getWeekStartDate } from "@/lib/dates";
import type { ShiftName } from "@/lib/worker-schedules";

export async function hasWeeklyToleranceBeenUsed(
  workerId: number,
  shift: ShiftName,
  date: Date
) {
  const weekStart = getWeekStartDate(date);
  const weekEnd = getWeekEndDate(date);

  const [record] = await db
    .select({ id: shiftAttendanceRecords.id })
    .from(shiftAttendanceRecords)
    .where(
      and(
        eq(shiftAttendanceRecords.workerId, workerId),
        eq(shiftAttendanceRecords.shiftType, shift),
        eq(shiftAttendanceRecords.toleranceUsed, true),
        gte(shiftAttendanceRecords.date, weekStart),
        lte(shiftAttendanceRecords.date, weekEnd)
      )
    )
    .limit(1);

  return Boolean(record);
}
