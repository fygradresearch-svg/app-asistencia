import type { AttendanceStatus } from "@/db/schema";
import { minutesAfterEntry } from "@/lib/dates";

export type AttendancePenalty = {
  attendanceStatus: AttendanceStatus;
  lateMinutes: number;
  fineAmountCents: number;
  penaltyLabel: string;
};

export function evaluateAttendancePenalty(
  now: Date,
  entryTime: string,
  toleranceMinutes: number
): AttendancePenalty {
  const lateMinutes = Math.max(0, minutesAfterEntry(now, entryTime));
  const tolerance = Math.max(0, toleranceMinutes);

  if (lateMinutes < tolerance) {
    return {
      attendanceStatus: "punctual",
      lateMinutes,
      fineAmountCents: 0,
      penaltyLabel: "Sin multa"
    };
  }

  if (lateMinutes <= tolerance + 10) {
    return {
      attendanceStatus: "late",
      lateMinutes,
      fineAmountCents: 1000,
      penaltyLabel: "S/. 10.00"
    };
  }

  if (lateMinutes <= tolerance + 20) {
    return {
      attendanceStatus: "late",
      lateMinutes,
      fineAmountCents: 2000,
      penaltyLabel: "S/. 20.00"
    };
  }

  return {
    attendanceStatus: "absent",
    lateMinutes,
    fineAmountCents: 4000,
    penaltyLabel: "Falta - S/. 40.00"
  };
}

export function formatFineAmount(fineAmountCents: number) {
  if (!fineAmountCents) {
    return "S/. 0.00";
  }

  return `S/. ${(fineAmountCents / 100).toFixed(2)}`;
}
