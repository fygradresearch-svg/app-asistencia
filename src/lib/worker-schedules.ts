import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { workerDaySchedules } from "@/db/schema";
import { getCurrentSchedule } from "@/lib/data";
import { getBusinessTime, getBusinessWeekday, minutesFromTime } from "@/lib/dates";
import { DEFAULT_SHIFT_SCHEDULE } from "@/lib/defaults";

export type ShiftName = "morning" | "afternoon";

export type DayShiftSchedule = {
  morningEntryTime: string | null;
  morningExitTime: string | null;
  afternoonEntryTime: string | null;
  afternoonExitTime: string | null;
  toleranceMinutes: number;
};

type WorkerScheduleSource = {
  id: number;
  scheduleEntryTime: string | null;
  scheduleExitTime: string | null;
  scheduleToleranceMinutes: number | null;
};

export function hasShift(schedule: DayShiftSchedule, shift: ShiftName) {
  return shift === "morning"
    ? Boolean(schedule.morningEntryTime && schedule.morningExitTime)
    : Boolean(schedule.afternoonEntryTime && schedule.afternoonExitTime);
}

export function getShiftEntryTime(schedule: DayShiftSchedule, shift: ShiftName) {
  return shift === "morning" ? schedule.morningEntryTime : schedule.afternoonEntryTime;
}

export function getShiftForCheckIn(
  now: Date,
  schedule: DayShiftSchedule
): ShiftName | null {
  const hasMorning = hasShift(schedule, "morning");
  const hasAfternoon = hasShift(schedule, "afternoon");

  if (!hasMorning && !hasAfternoon) {
    return null;
  }

  if (hasMorning && !hasAfternoon) {
    return "morning";
  }

  if (!hasMorning && hasAfternoon) {
    return "afternoon";
  }

  const currentMinutes = minutesFromTime(getBusinessTime(now).slice(0, 5));
  return currentMinutes >= minutesFromTime(schedule.afternoonEntryTime ?? "00:00")
    ? "afternoon"
    : "morning";
}

export async function getScheduleForWorker(
  worker: WorkerScheduleSource | null,
  date: Date
): Promise<DayShiftSchedule | null> {
  if (!worker) {
    return null;
  }

  const weekday = getBusinessWeekday(date);
  const [daySchedule] = await db
    .select()
    .from(workerDaySchedules)
    .where(
      and(
        eq(workerDaySchedules.workerId, worker.id),
        eq(workerDaySchedules.weekday, weekday)
      )
    )
    .limit(1);

  if (daySchedule) {
    const hasStoredShiftFields = Boolean(
      daySchedule.morningEntryTime ||
        daySchedule.morningExitTime ||
        daySchedule.afternoonEntryTime ||
        daySchedule.afternoonExitTime
    );

    if (!hasStoredShiftFields) {
      return {
        morningEntryTime: daySchedule.entryTime,
        morningExitTime: DEFAULT_SHIFT_SCHEDULE.morningExitTime,
        afternoonEntryTime: DEFAULT_SHIFT_SCHEDULE.afternoonEntryTime,
        afternoonExitTime: daySchedule.exitTime,
        toleranceMinutes: 0
      };
    }

    return {
      morningEntryTime: daySchedule.morningEntryTime,
      morningExitTime: daySchedule.morningExitTime,
      afternoonEntryTime: daySchedule.afternoonEntryTime,
      afternoonExitTime: daySchedule.afternoonExitTime,
      toleranceMinutes: daySchedule.toleranceMinutes
    };
  }

  if (
    worker.scheduleEntryTime &&
    worker.scheduleExitTime &&
    worker.scheduleToleranceMinutes !== null
  ) {
    return {
      morningEntryTime: worker.scheduleEntryTime,
      morningExitTime: DEFAULT_SHIFT_SCHEDULE.morningExitTime,
      afternoonEntryTime: DEFAULT_SHIFT_SCHEDULE.afternoonEntryTime,
      afternoonExitTime: worker.scheduleExitTime,
      toleranceMinutes: worker.scheduleToleranceMinutes
    };
  }

  const schedule = await getCurrentSchedule();
  return {
    morningEntryTime: schedule?.entryTime ?? DEFAULT_SHIFT_SCHEDULE.morningEntryTime,
    morningExitTime: DEFAULT_SHIFT_SCHEDULE.morningExitTime,
    afternoonEntryTime: DEFAULT_SHIFT_SCHEDULE.afternoonEntryTime,
    afternoonExitTime: schedule?.exitTime ?? DEFAULT_SHIFT_SCHEDULE.afternoonExitTime,
    toleranceMinutes: schedule?.toleranceMinutes ?? DEFAULT_SHIFT_SCHEDULE.toleranceMinutes
  };
}
