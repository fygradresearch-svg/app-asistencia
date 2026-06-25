import type { ShiftAttendanceStatus } from "@/db/schema";
import { minutesAfterEntry } from "@/lib/dates";
import { WEEKLY_TOLERANCE_MAX_MINUTES } from "@/lib/defaults";

export type ShiftPenalty = {
  status: ShiftAttendanceStatus;
  lateMinutes: number;
  fineAmountCents: number;
  toleranceUsed: boolean;
  penaltyLabel: string;
};

export const ABSENCE_PENALTY: ShiftPenalty = {
  status: "absent",
  lateMinutes: 0,
  fineAmountCents: 2000,
  toleranceUsed: false,
  penaltyLabel: "Falta - S/. 20.00"
};

export function evaluateShiftPenalty(
  now: Date,
  entryTime: string,
  weeklyToleranceUsed: boolean
): ShiftPenalty {
  const lateMinutes = Math.max(0, minutesAfterEntry(now, entryTime));

  if (lateMinutes === 0) {
    return {
      status: "punctual",
      lateMinutes: 0,
      fineAmountCents: 0,
      toleranceUsed: false,
      penaltyLabel: "Sin multa"
    };
  }

  if (lateMinutes <= WEEKLY_TOLERANCE_MAX_MINUTES && !weeklyToleranceUsed) {
    return {
      status: "tolerance",
      lateMinutes,
      fineAmountCents: 0,
      toleranceUsed: true,
      penaltyLabel: "Sin multa"
    };
  }

  if (lateMinutes <= 20) {
    return {
      status: "late",
      lateMinutes,
      fineAmountCents: 1000,
      toleranceUsed: false,
      penaltyLabel: "S/. 10.00"
    };
  }

  if (lateMinutes <= 30) {
    return {
      status: "late",
      lateMinutes,
      fineAmountCents: 2000,
      toleranceUsed: false,
      penaltyLabel: "S/. 20.00"
    };
  }

  return {
    ...ABSENCE_PENALTY,
    lateMinutes
  };
}

export function formatFineAmount(fineAmountCents: number) {
  if (!fineAmountCents) {
    return "S/. 0.00";
  }

  return `S/. ${(fineAmountCents / 100).toFixed(2)}`;
}
