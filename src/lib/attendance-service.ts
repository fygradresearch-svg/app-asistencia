import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  attendanceAttempts,
  shiftAttendanceRecords,
  type AttemptType
} from "@/db/schema";
import { getBusinessDate } from "@/lib/dates";
import { MAX_GPS_RADIUS_METERS } from "@/lib/defaults";
import { getCurrentLocation } from "@/lib/data";
import { haversineDistanceMeters } from "@/lib/gps";
import { evaluateShiftPenalty } from "@/lib/penalties";
import { getWorkerByDni, isValidDni, normalizeDni } from "@/lib/worker-auth";
import { hasWeeklyToleranceBeenUsed } from "@/lib/weekly-tolerance";
import {
  getScheduleForWorker,
  getShiftEntryTime,
  getShiftForCheckIn,
  hasShift,
  type DayShiftSchedule,
  type ShiftName
} from "@/lib/worker-schedules";

type MarkAttendanceInput = {
  dni: string;
  type: AttemptType;
  latitude: number;
  longitude: number;
};

type MarkAttendanceResult = {
  status: number;
  body: Record<string, unknown>;
};

const GPS_OUTSIDE_ZONE_MESSAGE =
  "No se encuentra dentro de la zona autorizada para registrar asistencia.";

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
  records: (typeof shiftAttendanceRecords.$inferSelect)[],
  schedule: DayShiftSchedule
): ShiftName | null {
  const morning = records.find((record) => record.shiftType === "morning");
  const afternoon = records.find((record) => record.shiftType === "afternoon");

  if (hasShift(schedule, "afternoon") && afternoon?.serverTime && !afternoon.checkOutTime) {
    return "afternoon";
  }

  if (hasShift(schedule, "morning") && morning?.serverTime && !morning.checkOutTime) {
    return "morning";
  }

  return null;
}

function penaltyMessage(shift: ShiftName, penalty: ReturnType<typeof evaluateShiftPenalty>) {
  const shiftLabel = shift === "morning" ? "manana" : "tarde";

  if (penalty.status === "punctual") {
    return `Entrada de la ${shiftLabel} registrada.`;
  }

  if (penalty.status === "tolerance") {
    return `Entrada de la ${shiftLabel} registrada dentro de la tolerancia semanal.`;
  }

  if (penalty.status === "late") {
    return `Entrada de la ${shiftLabel} registrada con tardanza. Multa: ${penalty.penaltyLabel}.`;
  }

  return `Entrada de la ${shiftLabel} registrada como falta.`;
}

export async function markAttendance({
  dni,
  type,
  latitude,
  longitude
}: MarkAttendanceInput): Promise<MarkAttendanceResult> {
  const normalizedDni = normalizeDni(dni);

  if (!isValidDni(normalizedDni)) {
    return {
      status: 400,
      body: { error: "Ingresa un DNI valido de 8 digitos." }
    };
  }

  if (invalidCoordinates(latitude, longitude)) {
    return {
      status: 400,
      body: { error: "Coordenadas invalidas." }
    };
  }

  const worker = await getWorkerByDni(normalizedDni);
  if (!worker) {
    return {
      status: 404,
      body: { error: "DNI no registrado." }
    };
  }

  if (worker.status === "inactive") {
    return {
      status: 403,
      body: { error: "Trabajador inactivo." }
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
  const allowedRadius = Math.min(location.allowedRadiusMeters, MAX_GPS_RADIUS_METERS);
  const insideZone = distanceMeters <= allowedRadius;

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
        error: GPS_OUTSIDE_ZONE_MESSAGE,
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

  const todayRecords = await db
    .select()
    .from(shiftAttendanceRecords)
    .where(
      and(eq(shiftAttendanceRecords.workerId, worker.id), eq(shiftAttendanceRecords.date, today))
    );

  if (type === "check_in") {
    const shift = getShiftForCheckIn(now, schedule);
    const shiftEntryTime = shift ? getShiftEntryTime(schedule, shift) : null;

    if (!shift || !shiftEntryTime) {
      return {
        status: 400,
        body: { error: "No tienes un turno configurado para hoy." }
      };
    }

    const existingShiftRecord = todayRecords.find((record) => record.shiftType === shift);
    if (existingShiftRecord) {
      return {
        status: 409,
        body: {
          error: `Ya registraste tu entrada de la ${shift === "morning" ? "manana" : "tarde"}.`
        }
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

    const weeklyToleranceUsed = await hasWeeklyToleranceBeenUsed(worker.id, shift, now);
    const penalty = evaluateShiftPenalty(now, shiftEntryTime, weeklyToleranceUsed);

    const [record] = await db
      .insert(shiftAttendanceRecords)
      .values({
        workerId: worker.id,
        dni: worker.dni,
        date: today,
        serverTime: now,
        shiftType: shift,
        distanceMeters,
        latitude,
        longitude,
        status: penalty.status,
        lateMinutes: penalty.lateMinutes,
        fineAmountCents: penalty.fineAmountCents,
        toleranceUsed: penalty.toleranceUsed,
        updatedAt: now
      })
      .returning();

    return {
      status: 201,
      body: {
        ok: true,
        message: penaltyMessage(shift, penalty),
        record,
        distanceMeters
      }
    };
  }

  const shift = getShiftForCheckOut(todayRecords, schedule);
  if (!shift) {
    return {
      status: 409,
      body: { error: "No hay una entrada pendiente de salida." }
    };
  }

  const existingShiftRecord = todayRecords.find((record) => record.shiftType === shift);
  if (!existingShiftRecord) {
    return {
      status: 409,
      body: { error: "No puedes marcar salida sin una entrada previa." }
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
    .update(shiftAttendanceRecords)
    .set({
      checkOutTime: now,
      checkOutLatitude: latitude,
      checkOutLongitude: longitude,
      checkOutDistanceMeters: distanceMeters,
      updatedAt: now
    })
    .where(eq(shiftAttendanceRecords.id, existingShiftRecord.id))
    .returning();

  return {
    status: 200,
    body: {
      ok: true,
      message:
        shift === "morning" ? "Salida de la manana registrada." : "Salida de la tarde registrada.",
      record,
      distanceMeters
    }
  };
}

export async function verifyWorkerAccess(dni: string, latitude: number, longitude: number) {
  const normalizedDni = normalizeDni(dni);

  if (!isValidDni(normalizedDni)) {
    return {
      status: 400,
      body: { error: "Ingresa un DNI valido de 8 digitos." }
    };
  }

  if (invalidCoordinates(latitude, longitude)) {
    return {
      status: 400,
      body: { error: "Coordenadas invalidas." }
    };
  }

  const worker = await getWorkerByDni(normalizedDni);
  if (!worker) {
    return {
      status: 404,
      body: { error: "DNI no registrado." }
    };
  }

  if (worker.status === "inactive") {
    return {
      status: 403,
      body: { error: "Trabajador inactivo." }
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
  const allowedRadius = Math.min(location.allowedRadiusMeters, MAX_GPS_RADIUS_METERS);

  if (distanceMeters > allowedRadius) {
    return {
      status: 403,
      body: {
        error: GPS_OUTSIDE_ZONE_MESSAGE,
        distanceMeters
      }
    };
  }

  return {
    status: 200,
    body: {
      ok: true,
      worker: {
        id: worker.id,
        fullName: worker.fullName,
        dni: worker.dni,
        status: worker.status
      },
      distanceMeters
    }
  };
}
