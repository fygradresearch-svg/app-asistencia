import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { workerDaySchedules, workerScheduleOverrides, workerWeeklyScheduleDetails, workerWeeklySchedules } from "@/db/schema";
import { getCurrentSchedule } from "@/lib/data";
import { getBusinessDate, getBusinessTime, getBusinessWeekday, getWeekStartDate, minutesFromTime } from "@/lib/dates";
import { AFTERNOON_CHECKIN_EARLY_MINUTES, DEFAULT_SHIFT_SCHEDULE } from "@/lib/defaults";

export type ShiftName = "morning" | "afternoon";

export type DayShiftSchedule = {
  morningEntryTime: string | null;
  morningExitTime: string | null;
  afternoonEntryTime: string | null;
  afternoonExitTime: string | null;
  toleranceMinutes: number;
  source?: "override" | "weekly" | "worker" | "company" | "legacy";
  isSpecial?: boolean;
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

export function getAfternoonCheckInAvailableFrom(afternoonEntryTime: string | null) {
  if (!afternoonEntryTime) {
    return null;
  }

  const entryMinutes = minutesFromTime(afternoonEntryTime.slice(0, 5));
  const defaultAfternoonMinutes = minutesFromTime(DEFAULT_SHIFT_SCHEDULE.afternoonEntryTime);
  const availableMinutes =
    entryMinutes >= defaultAfternoonMinutes - AFTERNOON_CHECKIN_EARLY_MINUTES
      ? Math.max(0, entryMinutes - AFTERNOON_CHECKIN_EARLY_MINUTES)
      : entryMinutes;
  const hours = Math.floor(availableMinutes / 60);
  const minutes = availableMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function getAfternoonCheckInAvailableMinutes(afternoonEntryTime: string | null) {
  const availableFrom = getAfternoonCheckInAvailableFrom(afternoonEntryTime);
  return availableFrom ? minutesFromTime(availableFrom) : null;
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
    const availableMinutes = getAfternoonCheckInAvailableMinutes(schedule.afternoonEntryTime);
    const currentMinutes = minutesFromTime(getBusinessTime(now).slice(0, 5));
    if (availableMinutes !== null && currentMinutes < availableMinutes) {
      return null;
    }
    return "afternoon";
  }

  const currentMinutes = minutesFromTime(getBusinessTime(now).slice(0, 5));
  const availableMinutes = getAfternoonCheckInAvailableMinutes(schedule.afternoonEntryTime);
  return availableMinutes !== null && currentMinutes >= availableMinutes ? "afternoon" : "morning";
}

export async function getScheduleForWorker(
  worker: WorkerScheduleSource | null,
  date: Date
): Promise<DayShiftSchedule | null> {
  if (!worker) {
    return null;
  }

  const dateStr = getBusinessDate(date);
  const [override] = await db
    .select()
    .from(workerScheduleOverrides)
    .where(
      and(
        eq(workerScheduleOverrides.workerId, worker.id),
        eq(workerScheduleOverrides.date, dateStr)
      )
    )
    .limit(1);

  if (override) {
    return {
      morningEntryTime: override.morningEntryTime,
      morningExitTime: override.morningExitTime,
      afternoonEntryTime: override.afternoonEntryTime,
      afternoonExitTime: override.afternoonExitTime,
      toleranceMinutes: override.toleranceMinutes,
      source: "override",
      isSpecial: true
    };
  }

  const weekStart = getWeekStartDate(date);
  const [weeklySchedule] = await db.select().from(workerWeeklySchedules).where(
    and(eq(workerWeeklySchedules.workerId, worker.id), eq(workerWeeklySchedules.weekStart, weekStart))
  ).limit(1);
  if (weeklySchedule) {
    const [detail] = await db.select().from(workerWeeklyScheduleDetails).where(
      and(eq(workerWeeklyScheduleDetails.weeklyScheduleId, weeklySchedule.id), eq(workerWeeklyScheduleDetails.weekday, getBusinessWeekday(date)))
    ).limit(1);
    if (detail) return {
      morningEntryTime: detail.morningEnabled ? detail.morningEntryTime : null,
      morningExitTime: detail.morningEnabled ? detail.morningExitTime : null,
      afternoonEntryTime: detail.afternoonEnabled ? detail.afternoonEntryTime : null,
      afternoonExitTime: detail.afternoonEnabled ? detail.afternoonExitTime : null,
      toleranceMinutes: 0,
      source: "weekly"
    };
    return { morningEntryTime: null, morningExitTime: null, afternoonEntryTime: null, afternoonExitTime: null, toleranceMinutes: 0, source: "weekly" };
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
        toleranceMinutes: 0,
        source: "legacy"
      };
    }

    return {
      morningEntryTime: daySchedule.morningEntryTime,
      morningExitTime: daySchedule.morningExitTime,
      afternoonEntryTime: daySchedule.afternoonEntryTime,
      afternoonExitTime: daySchedule.afternoonExitTime,
      toleranceMinutes: daySchedule.toleranceMinutes,
      source: "worker"
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
      toleranceMinutes: worker.scheduleToleranceMinutes,
      source: "worker"
    };
  }

  const schedule = await getCurrentSchedule();
  return {
    morningEntryTime: schedule?.entryTime ?? DEFAULT_SHIFT_SCHEDULE.morningEntryTime,
    morningExitTime: DEFAULT_SHIFT_SCHEDULE.morningExitTime,
    afternoonEntryTime: DEFAULT_SHIFT_SCHEDULE.afternoonEntryTime,
    afternoonExitTime: schedule?.exitTime ?? DEFAULT_SHIFT_SCHEDULE.afternoonExitTime,
    toleranceMinutes: schedule?.toleranceMinutes ?? DEFAULT_SHIFT_SCHEDULE.toleranceMinutes,
    source: "company"
  };
}

/** Public centralized resolver. Kept as an alias for backwards compatibility. */
export const getEffectiveSchedule = getScheduleForWorker;

export function getShiftExitTime(schedule: DayShiftSchedule, shift: ShiftName) {
  return shift === "morning" ? schedule.morningExitTime : schedule.afternoonExitTime;
}
