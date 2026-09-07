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
  await recalculateAttendanceRange(workerId, weekStart, weekEnd);
}

export async function recalculateAllAttendanceForWorker(workerId: number) {
  await recalculateAttendanceRange(workerId);
}

async function recalculateAttendanceRange(workerId: number, from?: string, to?: string) {
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

    const entryTime = getShiftEntryTime(schedule, record.shiftType);
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
