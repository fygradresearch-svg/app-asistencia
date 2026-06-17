import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { shiftAttendanceRecords } from "@/db/schema";
import { getBusinessDate, getBusinessTime, minutesFromTime } from "@/lib/dates";
import { jsonError, parseNumber } from "@/lib/http";
import { getWorkerByDni, isValidDni, normalizeDni } from "@/lib/worker-auth";
import {
  getScheduleForWorker,
  getShiftForCheckIn,
  hasShift,
  type DayShiftSchedule,
  type ShiftName
} from "@/lib/worker-schedules";

function getNextAction(
  records: (typeof shiftAttendanceRecords.$inferSelect)[],
  now: Date,
  schedule: DayShiftSchedule
): {
  activeShift: ShiftName | null;
  nextAction: "check_in" | "check_out" | "waiting_afternoon" | "complete" | "no_schedule";
} {
  const hasMorning = hasShift(schedule, "morning");
  const hasAfternoon = hasShift(schedule, "afternoon");
  const morning = records.find((record) => record.shiftType === "morning");
  const afternoon = records.find((record) => record.shiftType === "afternoon");

  if (!hasMorning && !hasAfternoon) {
    return { activeShift: null, nextAction: "no_schedule" };
  }

  if (hasMorning && morning?.serverTime && !morning.checkOutTime) {
    return { activeShift: "morning", nextAction: "check_out" };
  }

  if (hasAfternoon && afternoon?.serverTime && !afternoon.checkOutTime) {
    return { activeShift: "afternoon", nextAction: "check_out" };
  }

  if (hasMorning && !morning?.serverTime) {
    if (!hasAfternoon || !schedule.afternoonEntryTime) {
      return { activeShift: "morning", nextAction: "check_in" };
    }

    const currentMinutes = minutesFromTime(getBusinessTime(now).slice(0, 5));
    const afternoonMinutes = minutesFromTime(schedule.afternoonEntryTime);
    if (currentMinutes < afternoonMinutes) {
      return { activeShift: "morning", nextAction: "check_in" };
    }
  }

  if (
    hasMorning &&
    hasAfternoon &&
    morning?.serverTime &&
    morning.checkOutTime &&
    !afternoon?.serverTime &&
    schedule.afternoonEntryTime
  ) {
    const currentMinutes = minutesFromTime(getBusinessTime(now).slice(0, 5));
    const afternoonMinutes = minutesFromTime(schedule.afternoonEntryTime);
    if (currentMinutes < afternoonMinutes) {
      return { activeShift: "afternoon", nextAction: "waiting_afternoon" };
    }
  }

  if (hasAfternoon && !afternoon?.serverTime) {
    return { activeShift: "afternoon", nextAction: "check_in" };
  }

  return { activeShift: getShiftForCheckIn(now, schedule), nextAction: "complete" };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { dni?: unknown } | null;
  const dni = normalizeDni(typeof body?.dni === "string" ? body.dni : "");

  if (!isValidDni(dni)) {
    return jsonError("Ingresa un DNI valido de 8 digitos.", 400);
  }

  const worker = await getWorkerByDni(dni);
  if (!worker) {
    return jsonError("DNI no registrado.", 404);
  }

  if (worker.status === "inactive") {
    return jsonError("Trabajador inactivo.", 403);
  }

  const today = getBusinessDate();
  const now = new Date();
  const schedule = await getScheduleForWorker(worker, now);
  const records = await db
    .select()
    .from(shiftAttendanceRecords)
    .where(
      and(eq(shiftAttendanceRecords.workerId, worker.id), eq(shiftAttendanceRecords.date, today))
    );

  const { activeShift, nextAction } = schedule
    ? getNextAction(records, now, schedule)
    : { activeShift: null, nextAction: "no_schedule" as const };

  return NextResponse.json({
    date: today,
    serverTime: getBusinessTime(),
    activeShift,
    nextAction,
    records
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const dni = normalizeDni(url.searchParams.get("dni") ?? "");
  const latitude = parseNumber(url.searchParams.get("latitude"));
  const longitude = parseNumber(url.searchParams.get("longitude"));

  if (!isValidDni(dni)) {
    return jsonError("Ingresa un DNI valido de 8 digitos.", 400);
  }

  const worker = await getWorkerByDni(dni);
  if (!worker) {
    return jsonError("DNI no registrado.", 404);
  }

  if (worker.status === "inactive") {
    return jsonError("Trabajador inactivo.", 403);
  }

  const today = getBusinessDate();
  const now = new Date();
  const schedule = await getScheduleForWorker(worker, now);
  const records = await db
    .select()
    .from(shiftAttendanceRecords)
    .where(
      and(eq(shiftAttendanceRecords.workerId, worker.id), eq(shiftAttendanceRecords.date, today))
    );

  const { activeShift, nextAction } = schedule
    ? getNextAction(records, now, schedule)
    : { activeShift: null, nextAction: "no_schedule" as const };

  return NextResponse.json({
    worker: {
      id: worker.id,
      fullName: worker.fullName,
      dni: worker.dni,
      status: worker.status
    },
    date: today,
    serverTime: getBusinessTime(),
    activeShift,
    nextAction,
    records,
    locationProvided: latitude !== null && longitude !== null
  });
}
