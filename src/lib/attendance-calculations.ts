import { minutesFromTime } from "@/lib/dates";

export function calculateScheduledMinutes(entry: string | null, exit: string | null) {
  if (!entry || !exit) return 0;
  return Math.max(0, minutesFromTime(exit.slice(0, 5)) - minutesFromTime(entry.slice(0, 5)));
}

export function calculateWorkedMinutes(checkIn: Date | null, checkOut: Date | null) {
  if (!checkIn || !checkOut) return 0;
  return Math.max(0, Math.round((checkOut.getTime() - checkIn.getTime()) / 60000));
}

export function calculateHourTotals(scheduledMinutes: number, workedMinutes: number) {
  const difference = workedMinutes - scheduledMinutes;
  return {
    missingMinutes: Math.max(0, -difference),
    additionalMinutes: Math.max(0, difference)
  };
}

export function formatMinutes(minutes: number) {
  return `${Math.floor(Math.abs(minutes) / 60)}:${String(Math.abs(minutes) % 60).padStart(2, "0")}`;
}
