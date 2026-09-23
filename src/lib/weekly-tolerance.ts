import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { shiftAttendanceRecords, workers } from "@/db/schema";
import { getWeekEndDate, getWeekStartDate } from "@/lib/dates";
import { getScheduleForWorker, getShiftEntryTime } from "@/lib/worker-schedules";
import { evaluateShiftPenalty } from "@/lib/penalties";
import { getShiftExitTime } from "@/lib/worker-schedules";
import { calculateHourTotals, calculateScheduledMinutes, calculateWorkedMinutes } from "@/lib/attendance-calculations";
import { getBusinessDate, parseDateTimeInZone } from "@/lib/dates";

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
  date: Date,
  forceScheduleSnapshot = false
) {
  const weekStart = getWeekStartDate(date);
  const weekEnd = getWeekEndDate(date);
  await recalculateAttendanceRange(workerId, weekStart, weekEnd, forceScheduleSnapshot);
}

export async function recalculateAllAttendanceForWorker(workerId: number) {
  await recalculateAttendanceRange(workerId);
}

async function recalculateAttendanceRange(workerId: number, from?: string, to?: string, forceScheduleSnapshot = false) {
  const conditions = [eq(shiftAttendanceRecords.workerId, workerId)];

  if (from) {
    conditions.push(gte(shiftAttendanceRecords.date, from));
  }

  if (to) {
    conditions.push(lte(shiftAttendanceRecords.date, to));
  }

  const records = await db
    .select()
    .from(shiftAttendanceRecords)
    .where(and(...conditions))
    .orderBy(shiftAttendanceRecords.date, shiftAttendanceRecords.serverTime);

  const [worker] = await db
    .select()
    .from(workers)
    .where(eq(workers.id, workerId))
    .limit(1);

  if (!worker) return;

  let toleranceUsedInWeek = false;
  let currentWeekStart: string | null = null;

  for (const record of records) {
    const recordDate = new Date(record.serverTime);
    const recordWeekStart = getWeekStartDate(recordDate);

    if (currentWeekStart !== recordWeekStart) {
      currentWeekStart = recordWeekStart;
      toleranceUsedInWeek = false;
    }

    const schedule = await getScheduleForWorker(worker, recordDate);

    if (!schedule) continue;

    const resolvedEntryTime = getShiftEntryTime(schedule, record.shiftType);
    const resolvedExitTime = getShiftExitTime(schedule, record.shiftType);
    const useSnapshot = !forceScheduleSnapshot && record.date >= "2026-09-01" && Boolean(record.scheduledEntryTime);
    const entryTime = useSnapshot ? record.scheduledEntryTime : resolvedEntryTime;
    const exitTime = useSnapshot ? record.scheduledExitTime : resolvedExitTime;
    if (!entryTime) continue;

    const penalty = evaluateShiftPenalty(
      record.serverTime,
      entryTime,
      toleranceUsedInWeek,
      worker.workerType !== "intern"
    );

    if (penalty.toleranceUsed) {
      toleranceUsedInWeek = true;
    }

    let checkOutTime = record.checkOutTime;
    let checkoutSource = record.checkoutSource;
    let checkoutMissing = record.checkoutMissing;
    // A past shift with an entry and no exit receives an auditable calculated exit.
    if (!checkOutTime && exitTime && record.date < getBusinessDate()) {
      checkOutTime = parseDateTimeInZone(record.date, exitTime.slice(0, 5));
      checkoutSource = "automatic";
      checkoutMissing = true;
    }
    const scheduledMinutes = calculateScheduledMinutes(entryTime, exitTime);
    const workedMinutes = calculateWorkedMinutes(record.serverTime, checkOutTime);
    const hourTotals = calculateHourTotals(scheduledMinutes, workedMinutes);

    await db
      .update(shiftAttendanceRecords)
      .set({
        status: penalty.status,
        lateMinutes: penalty.lateMinutes,
        fineAmountCents: penalty.fineAmountCents,
        toleranceUsed: penalty.toleranceUsed,
        checkOutTime,
        checkoutSource,
        checkoutMissing,
        scheduledEntryTime: entryTime,
        scheduledExitTime: exitTime,
        scheduleSource: useSnapshot ? record.scheduleSource : (schedule.source ?? "legacy"),
        scheduledMinutes,
        workedMinutes,
        missingMinutes: hourTotals.missingMinutes,
        additionalMinutes: hourTotals.additionalMinutes,
        updatedAt: new Date()
      })
      .where(eq(shiftAttendanceRecords.id, record.id));
  }
}
