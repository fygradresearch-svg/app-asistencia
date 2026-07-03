import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { shiftAttendanceRecords, workers } from "@/db/schema";
import { getWeekEndDate, getWeekStartDate } from "@/lib/dates";
import { getScheduleForWorker, getShiftEntryTime } from "@/lib/worker-schedules";
import { evaluateShiftPenalty } from "@/lib/penalties";

export async function hasWeeklyToleranceBeenUsed(
  workerId: number,
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
        eq(shiftAttendanceRecords.toleranceUsed, true),
        gte(shiftAttendanceRecords.date, weekStart),
        lte(shiftAttendanceRecords.date, weekEnd)
      )
    )
    .limit(1);

  return Boolean(record);
}

export async function recalculateWeeklyAttendance(
  workerId: number,
  date: Date
) {
  const weekStart = getWeekStartDate(date);
  const weekEnd = getWeekEndDate(date);

  // Fetch all attendance records for the worker in that week across all shifts, sorted chronologically by serverTime
  const records = await db
    .select()
    .from(shiftAttendanceRecords)
    .where(
      and(
        eq(shiftAttendanceRecords.workerId, workerId),
        gte(shiftAttendanceRecords.date, weekStart),
        lte(shiftAttendanceRecords.date, weekEnd)
      )
    )
    .orderBy(shiftAttendanceRecords.serverTime);

  // Fetch worker schedule settings
  const [worker] = await db
    .select()
    .from(workers)
    .where(eq(workers.id, workerId))
    .limit(1);

  if (!worker) return;

  let toleranceUsedInWeek = false;

  for (const record of records) {
    const recordDate = new Date(record.serverTime);
    const schedule = await getScheduleForWorker(worker, recordDate);

    if (!schedule) continue;

    const entryTime = getShiftEntryTime(schedule, record.shiftType);
    if (!entryTime) continue;

    // Recalculate using the current state of toleranceUsedInWeek
    const penalty = evaluateShiftPenalty(record.serverTime, entryTime, toleranceUsedInWeek);

    if (penalty.toleranceUsed) {
      toleranceUsedInWeek = true;
    }

    await db
      .update(shiftAttendanceRecords)
      .set({
        status: penalty.status,
        lateMinutes: penalty.lateMinutes,
        fineAmountCents: penalty.fineAmountCents,
        toleranceUsed: penalty.toleranceUsed,
        updatedAt: new Date()
      })
      .where(eq(shiftAttendanceRecords.id, record.id));
  }
}
