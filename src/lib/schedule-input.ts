import { minutesFromTime } from "@/lib/dates";
import { isTimeString, parseNumber } from "@/lib/http";

export type DayScheduleInput = {
  weekday?: unknown;
  entryTime?: string | null;
  exitTime?: string | null;
  morningEntryTime?: string | null;
  morningExitTime?: string | null;
  afternoonEntryTime?: string | null;
  afternoonExitTime?: string | null;
  toleranceMinutes?: unknown;
};

function cleanTime(value: string | null | undefined) {
  return value?.trim() || null;
}

function validShift(entryTime: string | null, exitTime: string | null) {
  if (!entryTime && !exitTime) {
    return true;
  }

  return (
    isTimeString(entryTime) &&
    isTimeString(exitTime) &&
    minutesFromTime(entryTime) < minutesFromTime(exitTime)
  );
}

export function normalizeDaySchedules(input: DayScheduleInput[] | undefined) {
  if (!input?.length) {
    return [];
  }

  const seen = new Set<number>();
  return input.map((schedule) => {
    const weekday = parseNumber(schedule.weekday);
    const hasExplicitMorning =
      schedule.morningEntryTime !== undefined || schedule.morningExitTime !== undefined;
    const hasExplicitAfternoon =
      schedule.afternoonEntryTime !== undefined || schedule.afternoonExitTime !== undefined;

    const morningEntryTime = cleanTime(
      hasExplicitMorning ? schedule.morningEntryTime : schedule.entryTime
    );
    const morningExitTime = cleanTime(
      hasExplicitMorning ? schedule.morningExitTime : "13:00"
    );
    const afternoonEntryTime = cleanTime(
      hasExplicitAfternoon ? schedule.afternoonEntryTime : "14:30"
    );
    const afternoonExitTime = cleanTime(
      hasExplicitAfternoon ? schedule.afternoonExitTime : schedule.exitTime
    );
    const hasMorning = Boolean(morningEntryTime || morningExitTime);
    const hasAfternoon = Boolean(afternoonEntryTime || afternoonExitTime);

    if (
      weekday === null ||
      weekday < 1 ||
      weekday > 5 ||
      !Number.isInteger(weekday) ||
      seen.has(weekday) ||
      (!hasMorning && !hasAfternoon) ||
      !validShift(morningEntryTime, morningExitTime) ||
      !validShift(afternoonEntryTime, afternoonExitTime)
    ) {
      throw new Error("Horario por dia invalido.");
    }

    if (
      morningExitTime &&
      afternoonEntryTime &&
      minutesFromTime(morningExitTime) > minutesFromTime(afternoonEntryTime)
    ) {
      throw new Error("Los turnos del dia se cruzan.");
    }

    seen.add(weekday);
    return {
      weekday,
      entryTime: morningEntryTime ?? afternoonEntryTime ?? "08:00",
      exitTime: afternoonExitTime ?? morningExitTime ?? "19:00",
      morningEntryTime,
      morningExitTime,
      afternoonEntryTime,
      afternoonExitTime,
      toleranceMinutes: 0
    };
  });
}
