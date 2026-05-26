import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  attendanceAttempts,
  attendanceRecords,
  workerDaySchedules,
  type AttemptType
} from "@/db/schema";
import { getBusinessDate, getBusinessWeekday, isLateForSchedule } from "@/lib/dates";
import { getCurrentLocation, getCurrentSchedule } from "@/lib/data";
import { haversineDistanceMeters } from "@/lib/gps";
import { getWorkerFromRequest } from "@/lib/worker-auth";

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
) {
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
      entryTime: daySchedule.entryTime,
      exitTime: daySchedule.exitTime,
      toleranceMinutes: daySchedule.toleranceMinutes
    };
  }

  if (
    worker.scheduleEntryTime &&
    worker.scheduleExitTime &&
    worker.scheduleToleranceMinutes !== null
  ) {
    return {
      entryTime: worker.scheduleEntryTime,
      exitTime: worker.scheduleExitTime,
      toleranceMinutes: worker.scheduleToleranceMinutes
    };
  }

  return getCurrentSchedule();
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

  const [existing] = await db
    .select()
    .from(attendanceRecords)
    .where(and(eq(attendanceRecords.workerId, worker.id), eq(attendanceRecords.date, today)))
    .limit(1);

  if (type === "check_in") {
    if (existing?.checkInTime) {
      return {
        status: 409,
        body: { error: "Ya registraste tu entrada de hoy." }
      };
    }

    const schedule = await getScheduleForWorker(worker, now);
    if (!schedule) {
      return {
        status: 400,
        body: { error: "No existe un horario laboral configurado." }
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

    const attendanceStatus = isLateForSchedule(
      now,
      schedule.entryTime,
      schedule.toleranceMinutes
    )
      ? "late"
      : "punctual";

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
        attendanceStatus,
        updatedAt: now
      })
      .returning();

    return {
      status: 201,
      body: {
        ok: true,
        message: attendanceStatus === "late" ? "Entrada registrada con tardanza." : "Entrada registrada.",
        record,
        distanceMeters
      }
    };
  }

  if (!existing?.checkInTime) {
    return {
      status: 409,
      body: { error: "No puedes marcar salida sin una entrada previa." }
    };
  }

  if (existing.checkOutTime) {
    return {
      status: 409,
      body: { error: "Ya registraste tu salida de hoy." }
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

  const [record] = await db
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
    .returning();

  return {
    status: 200,
    body: {
      ok: true,
      message: "Salida registrada.",
      record,
      distanceMeters
    }
  };
}
