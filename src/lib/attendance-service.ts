import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  attendanceAttempts,
  attendanceRecords,
  workerDaySchedules,
  type AttemptType
} from "@/db/schema";
import { getBusinessDate, getBusinessTime, getBusinessWeekday, minutesFromTime } from "@/lib/dates";
import { getCurrentLocation, getCurrentSchedule } from "@/lib/data";
import { DEFAULT_SHIFT_SCHEDULE } from "@/lib/defaults";
import { haversineDistanceMeters } from "@/lib/gps";
import { evaluateAttendancePenalty } from "@/lib/penalties";
import { getWorkerFromRequest } from "@/lib/worker-auth";

type ShiftName = "morning" | "afternoon";

type DayShiftSchedule = {
  morningEntryTime: string;
  morningExitTime: string;
  afternoonEntryTime: string;
  afternoonExitTime: string;
  toleranceMinutes: number;
};

type MarkAttendanceInput = {
  request: Request;
  type: AttemptType;
  latitude: number;
  longitude: number;
};

type MarkAttendanceResult = {
  status: number;
  body: Record<string, unknown>;
};

function invalidCoordinates(latitude: number, longitude: number) {
  return (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  );
}

async function getScheduleForWorker(
  worker: Awaited<ReturnType<typeof getWorkerFromRequest>>,
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
    return {
      morningEntryTime: daySchedule.morningEntryTime ?? daySchedule.entryTime,
      morningExitTime: daySchedule.morningExitTime ?? DEFAULT_SHIFT_SCHEDULE.morningExitTime,
      afternoonEntryTime:
        daySchedule.afternoonEntryTime ?? DEFAULT_SHIFT_SCHEDULE.afternoonEntryTime,
      afternoonExitTime: daySchedule.afternoonExitTime ?? daySchedule.exitTime,
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
    ...DEFAULT_SHIFT_SCHEDULE,
    toleranceMinutes: schedule?.toleranceMinutes ?? DEFAULT_SHIFT_SCHEDULE.toleranceMinutes
  };
}

function getShiftEntryTime(schedule: DayShiftSchedule, shift: ShiftName) {
  return shift === "morning" ? schedule.morningEntryTime : schedule.afternoonEntryTime;
}

function getShiftForCheckIn(now: Date, schedule: DayShiftSchedule): ShiftName {
  const currentMinutes = minutesFromTime(getBusinessTime(now).slice(0, 5));
  return currentMinutes >= minutesFromTime(schedule.afternoonEntryTime)
    ? "afternoon"
    : "morning";
}

function getShiftForCheckOut(
  record: typeof attendanceRecords.$inferSelect,
  now: Date,
  schedule: DayShiftSchedule
): ShiftName | null {
  const currentMinutes = minutesFromTime(getBusinessTime(now).slice(0, 5));
  const afternoonMinutes = minutesFromTime(schedule.afternoonEntryTime);

  if (record.afternoonCheckInTime && !record.afternoonCheckOutTime) {
    return "afternoon";
  }

  if (record.checkInTime && !record.checkOutTime) {
    return currentMinutes < afternoonMinutes ? "morning" : "morning";
  }

  return null;
}

function aggregateStatus(
  morningStatus: string | null,
  afternoonStatus: string | null
) {
  if (morningStatus === "absent" || afternoonStatus === "absent") {
    return "absent";
  }
  if (morningStatus === "late" || afternoonStatus === "late") {
    return "late";
  }
  if (morningStatus === "punctual" || afternoonStatus === "punctual") {
    return "punctual";
  }
  return "incomplete";
}

export async function markAttendance({
  request,
  type,
  latitude,
  longitude
}: MarkAttendanceInput): Promise<MarkAttendanceResult> {
  if (invalidCoordinates(latitude, longitude)) {
    return {
      status: 400,
      body: { error: "Coordenadas invalidas." }
    };
  }

  const worker = await getWorkerFromRequest(request);
  if (!worker) {
    return {
      status: 401,
      body: { error: "Token invalido o trabajador inactivo." }
    };
  }

  const location = await getCurrentLocation();
  if (!location) {
    return {
      status: 400,
      body: { error: "No existe una ubicacion autorizada configurada." }
    };
  }

  const distanceMeters = haversineDistanceMeters(
    latitude,
    longitude,
    location.latitude,
    location.longitude
  );
  const insideZone = distanceMeters <= location.allowedRadiusMeters;

  if (!insideZone) {
    await db.insert(attendanceAttempts).values({
      workerId: worker.id,
      type,
      latitude,
      longitude,
      distanceMeters,
      gpsStatus: "outside_zone",
      accepted: false,
      reason: "outside_zone"
    });

    return {
      status: 403,
      body: {
        error: "No puedes marcar asistencia porque estas fuera de la ubicacion autorizada.",
        distanceMeters
      }
    };
  }

  const now = new Date();
  const today = getBusinessDate(now);
  const schedule = await getScheduleForWorker(worker, now);
  if (!schedule) {
    return {
      status: 400,
      body: { error: "No existe un horario laboral configurado." }
    };
  }

  const [existing] = await db
    .select()
    .from(attendanceRecords)
    .where(and(eq(attendanceRecords.workerId, worker.id), eq(attendanceRecords.date, today)))
    .limit(1);

  if (type === "check_in") {
    const shift = getShiftForCheckIn(now, schedule);

    if (shift === "morning" && existing?.checkInTime) {
      return {
        status: 409,
        body: { error: "Ya registraste tu entrada de la manana." }
      };
    }

    if (shift === "afternoon" && existing?.afternoonCheckInTime) {
      return {
        status: 409,
        body: { error: "Ya registraste tu entrada de la tarde." }
      };
    }

    await db.insert(attendanceAttempts).values({
      workerId: worker.id,
      type,
      latitude,
      longitude,
      distanceMeters,
      gpsStatus: "valid",
      accepted: true
    });

    const penalty = evaluateAttendancePenalty(now, getShiftEntryTime(schedule, shift), schedule.toleranceMinutes);

    if (shift === "afternoon") {
      const morningStatus = existing?.checkInTime
        ? existing.attendanceStatus === "late"
          ? "late"
          : "punctual"
        : "absent";
      const attendanceStatus = aggregateStatus(morningStatus, penalty.attendanceStatus);

      if (existing) {
        const [record] = await db
          .update(attendanceRecords)
          .set({
            afternoonCheckInTime: now,
            afternoonCheckInLatitude: latitude,
            afternoonCheckInLongitude: longitude,
            afternoonCheckInDistanceMeters: distanceMeters,
            afternoonLateMinutes: penalty.lateMinutes,
            afternoonFineAmountCents: penalty.fineAmountCents,
            afternoonPenaltyLabel: penalty.penaltyLabel,
            totalFineAmountCents: existing.fineAmountCents + penalty.fineAmountCents,
            attendanceStatus,
            gpsStatus: "valid",
            updatedAt: now
          })
          .where(eq(attendanceRecords.id, existing.id))
          .returning();

        return {
          status: 200,
          body: {
            ok: true,
            message:
              penalty.attendanceStatus === "late"
                ? `Entrada de la tarde registrada con tardanza. Multa: ${penalty.penaltyLabel}.`
                : penalty.attendanceStatus === "absent"
                  ? "Entrada de la tarde registrada como falta."
                  : "Entrada de la tarde registrada.",
            record,
            distanceMeters
          }
        };
      }

      const [record] = await db
        .insert(attendanceRecords)
        .values({
          workerId: worker.id,
          date: today,
          afternoonCheckInTime: now,
          afternoonCheckInLatitude: latitude,
          afternoonCheckInLongitude: longitude,
          afternoonCheckInDistanceMeters: distanceMeters,
          gpsStatus: "valid",
          attendanceStatus,
          lateMinutes: 0,
          fineAmountCents: 0,
          penaltyLabel: "Falta",
          afternoonLateMinutes: penalty.lateMinutes,
          afternoonFineAmountCents: penalty.fineAmountCents,
          afternoonPenaltyLabel: penalty.penaltyLabel,
          totalFineAmountCents: penalty.fineAmountCents,
          updatedAt: now
        })
        .returning();

      return {
        status: 201,
        body: {
          ok: true,
          message:
            penalty.attendanceStatus === "late"
              ? `Entrada de la tarde registrada con tardanza. Multa: ${penalty.penaltyLabel}.`
              : penalty.attendanceStatus === "absent"
                ? "Entrada de la tarde registrada como falta."
                : "Entrada de la tarde registrada.",
          record,
          distanceMeters
        }
      };
    }

    const [record] = await db
      .insert(attendanceRecords)
      .values({
        workerId: worker.id,
        date: today,
        checkInTime: now,
        checkInLatitude: latitude,
        checkInLongitude: longitude,
        checkInDistanceMeters: distanceMeters,
        gpsStatus: "valid",
        attendanceStatus: penalty.attendanceStatus,
        lateMinutes: penalty.lateMinutes,
        fineAmountCents: penalty.fineAmountCents,
        penaltyLabel: penalty.penaltyLabel,
        totalFineAmountCents: penalty.fineAmountCents,
        updatedAt: now
      })
      .returning();

    const messageByStatus = {
      punctual: "Entrada registrada.",
      late: `Entrada registrada con tardanza. Multa: ${penalty.penaltyLabel}.`,
      absent: "Entrada registrada como falta.",
      incomplete: "Entrada registrada.",
      rejected_gps: "Entrada registrada."
    };

    return {
      status: 201,
      body: {
        ok: true,
        message: messageByStatus[penalty.attendanceStatus].replace("Entrada", "Entrada de la manana"),
        record,
        distanceMeters
      }
    };
  }

  if (!existing) {
    return {
      status: 409,
      body: { error: "No puedes marcar salida sin una entrada previa." }
    };
  }

  const shift = getShiftForCheckOut(existing, now, schedule);

  if (!shift) {
    return {
      status: 409,
      body: { error: "No hay una entrada pendiente de salida." }
    };
  }

  await db.insert(attendanceAttempts).values({
    workerId: worker.id,
    type,
    latitude,
    longitude,
    distanceMeters,
    gpsStatus: "valid",
    accepted: true
  });

  const [record] =
    shift === "morning"
      ? await db
          .update(attendanceRecords)
          .set({
            checkOutTime: now,
            checkOutLatitude: latitude,
            checkOutLongitude: longitude,
            checkOutDistanceMeters: distanceMeters,
            gpsStatus: "valid",
            updatedAt: now
          })
          .where(eq(attendanceRecords.id, existing.id))
          .returning()
      : await db
          .update(attendanceRecords)
          .set({
            afternoonCheckOutTime: now,
            afternoonCheckOutLatitude: latitude,
            afternoonCheckOutLongitude: longitude,
            afternoonCheckOutDistanceMeters: distanceMeters,
            gpsStatus: "valid",
            updatedAt: now
          })
          .where(eq(attendanceRecords.id, existing.id))
          .returning();

  return {
    status: 200,
    body: {
      ok: true,
      message: shift === "morning" ? "Salida de la manana registrada." : "Salida de la tarde registrada.",
      record,
      distanceMeters
    }
  };
}
