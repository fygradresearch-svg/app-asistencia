import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  attendanceAttempts,
  attendanceRecords,
  type AttemptType
} from "@/db/schema";
import { getBusinessDate } from "@/lib/dates";
import { getCurrentLocation } from "@/lib/data";
import { haversineDistanceMeters } from "@/lib/gps";
import { ABSENCE_PENALTY, evaluateAttendancePenalty } from "@/lib/penalties";
import { getWorkerFromRequest } from "@/lib/worker-auth";
import {
  getScheduleForWorker,
  getShiftEntryTime,
  getShiftForCheckIn,
  hasShift,
  type DayShiftSchedule,
  type ShiftName
} from "@/lib/worker-schedules";

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

function getShiftForCheckOut(
  record: typeof attendanceRecords.$inferSelect,
  schedule: DayShiftSchedule
): ShiftName | null {
  if (
    hasShift(schedule, "afternoon") &&
    record.afternoonCheckInTime &&
    !record.afternoonCheckOutTime
  ) {
    return "afternoon";
  }

  if (hasShift(schedule, "morning") && record.checkInTime && !record.checkOutTime) {
    return "morning";
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
  if (!schedule || (!hasShift(schedule, "morning") && !hasShift(schedule, "afternoon"))) {
    return {
      status: 400,
      body: { error: "No tienes un turno configurado para hoy." }
    };
  }

  const [existing] = await db
    .select()
    .from(attendanceRecords)
    .where(and(eq(attendanceRecords.workerId, worker.id), eq(attendanceRecords.date, today)))
    .limit(1);

  if (type === "check_in") {
    const shift = getShiftForCheckIn(now, schedule);
    const shiftEntryTime = shift ? getShiftEntryTime(schedule, shift) : null;

    if (!shift || !shiftEntryTime) {
      return {
        status: 400,
        body: { error: "No tienes un turno configurado para hoy." }
      };
    }

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

    const penalty = evaluateAttendancePenalty(now, shiftEntryTime, schedule.toleranceMinutes);

    if (shift === "afternoon") {
      const morningStatus = hasShift(schedule, "morning")
        ? existing?.checkInTime
          ? existing.attendanceStatus === "late" || existing.fineAmountCents > 0
            ? "late"
            : "punctual"
          : ABSENCE_PENALTY.attendanceStatus
        : null;
      const attendanceStatus = aggregateStatus(morningStatus, penalty.attendanceStatus);

      if (existing) {
        const morningFine = existing.checkInTime
          ? existing.fineAmountCents
          : hasShift(schedule, "morning")
            ? ABSENCE_PENALTY.fineAmountCents
            : 0;
        const [record] = await db
          .update(attendanceRecords)
          .set({
            ...(existing.checkInTime || !hasShift(schedule, "morning")
              ? {}
              : {
                  fineAmountCents: ABSENCE_PENALTY.fineAmountCents,
                  penaltyLabel: ABSENCE_PENALTY.penaltyLabel
                }),
            afternoonCheckInTime: now,
            afternoonCheckInLatitude: latitude,
            afternoonCheckInLongitude: longitude,
            afternoonCheckInDistanceMeters: distanceMeters,
            afternoonLateMinutes: penalty.lateMinutes,
            afternoonFineAmountCents: penalty.fineAmountCents,
            afternoonPenaltyLabel: penalty.penaltyLabel,
            totalFineAmountCents: morningFine + penalty.fineAmountCents,
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
          fineAmountCents: hasShift(schedule, "morning")
            ? ABSENCE_PENALTY.fineAmountCents
            : 0,
          penaltyLabel: hasShift(schedule, "morning")
            ? ABSENCE_PENALTY.penaltyLabel
            : "Sin multa",
          afternoonLateMinutes: penalty.lateMinutes,
          afternoonFineAmountCents: penalty.fineAmountCents,
          afternoonPenaltyLabel: penalty.penaltyLabel,
          totalFineAmountCents:
            (hasShift(schedule, "morning") ? ABSENCE_PENALTY.fineAmountCents : 0) +
            penalty.fineAmountCents,
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

  const shift = getShiftForCheckOut(existing, schedule);

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
