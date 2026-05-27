import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { workerDaySchedules, workers } from "@/db/schema";
import { requireAdminSession } from "@/lib/auth";
import { isTimeString, jsonError, parseNumber } from "@/lib/http";

type DayScheduleInput = {
  weekday?: unknown;
  entryTime?: string | null;
  exitTime?: string | null;
  morningEntryTime?: string | null;
  morningExitTime?: string | null;
  afternoonEntryTime?: string | null;
  afternoonExitTime?: string | null;
  toleranceMinutes?: unknown;
};

type WorkerScheduleBody = {
  useCustomSchedule?: boolean;
  scheduleEntryTime?: string | null;
  scheduleExitTime?: string | null;
  scheduleToleranceMinutes?: unknown;
  daySchedules?: DayScheduleInput[];
};

function normalizeDaySchedules(input: DayScheduleInput[] | undefined) {
  if (!input?.length) {
    return [];
  }

  const seen = new Set<number>();
  return input.map((schedule) => {
    const weekday = parseNumber(schedule.weekday);
    const toleranceMinutes = parseNumber(schedule.toleranceMinutes);
    const morningEntryTime = schedule.morningEntryTime ?? schedule.entryTime ?? null;
    const morningExitTime = schedule.morningExitTime ?? "13:00";
    const afternoonEntryTime = schedule.afternoonEntryTime ?? "15:00";
    const afternoonExitTime = schedule.afternoonExitTime ?? schedule.exitTime ?? null;

    if (
      weekday === null ||
      weekday < 1 ||
      weekday > 5 ||
      !Number.isInteger(weekday) ||
      seen.has(weekday) ||
      !isTimeString(morningEntryTime) ||
      !isTimeString(morningExitTime) ||
      !isTimeString(afternoonEntryTime) ||
      !isTimeString(afternoonExitTime) ||
      toleranceMinutes === null ||
      toleranceMinutes < 0
    ) {
      throw new Error("Horario por dia invalido.");
    }

    seen.add(weekday);
    return {
      weekday,
      entryTime: morningEntryTime,
      exitTime: afternoonExitTime,
      morningEntryTime,
      morningExitTime,
      afternoonEntryTime,
      afternoonExitTime,
      toleranceMinutes: Math.round(toleranceMinutes)
    };
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdminSession();
  if (!session) {
    return jsonError("No autorizado.", 401);
  }

  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id)) {
    return jsonError("ID invalido.", 400);
  }

  const body = (await request.json().catch(() => null)) as WorkerScheduleBody | null;
  let daySchedules: ReturnType<typeof normalizeDaySchedules> = [];

  try {
    daySchedules = normalizeDaySchedules(body?.daySchedules);
  } catch {
    return jsonError("Completa correctamente los horarios de lunes a viernes.", 400);
  }

  if (body?.daySchedules) {
    const [worker] = await db
      .update(workers)
      .set({
        scheduleEntryTime: null,
        scheduleExitTime: null,
        scheduleToleranceMinutes: null,
        updatedAt: new Date()
      })
      .where(eq(workers.id, id))
      .returning();

    if (!worker) {
      return jsonError("Trabajador no encontrado.", 404);
    }

    await db
      .delete(workerDaySchedules)
      .where(eq(workerDaySchedules.workerId, id));

    if (daySchedules.length) {
      await db.insert(workerDaySchedules).values(
        daySchedules.map((schedule) => ({
          workerId: id,
          ...schedule,
          updatedAt: new Date()
        }))
      );
    }

    return NextResponse.json({
      ...worker,
      daySchedules: daySchedules.map((schedule) => ({
        ...schedule,
        workerId: id
      }))
    });
  }

  if (!body?.useCustomSchedule) {
    await db
      .delete(workerDaySchedules)
      .where(eq(workerDaySchedules.workerId, id));

    const [updated] = await db
      .update(workers)
      .set({
        scheduleEntryTime: null,
        scheduleExitTime: null,
        scheduleToleranceMinutes: null,
        updatedAt: new Date()
      })
      .where(eq(workers.id, id))
      .returning();

    if (!updated) {
      return jsonError("Trabajador no encontrado.", 404);
    }

    return NextResponse.json(updated);
  }

  const scheduleEntryTime = body.scheduleEntryTime ?? null;
  const scheduleExitTime = body.scheduleExitTime ?? null;
  const scheduleToleranceMinutes = parseNumber(body.scheduleToleranceMinutes);

  if (
    !isTimeString(scheduleEntryTime) ||
    !isTimeString(scheduleExitTime) ||
    scheduleToleranceMinutes === null ||
    scheduleToleranceMinutes < 0
  ) {
    return jsonError("Completa correctamente el horario propio del trabajador.", 400);
  }

  await db
    .delete(workerDaySchedules)
    .where(eq(workerDaySchedules.workerId, id));

  const [updated] = await db
    .update(workers)
    .set({
      scheduleEntryTime,
      scheduleExitTime,
      scheduleToleranceMinutes: Math.round(scheduleToleranceMinutes),
      updatedAt: new Date()
    })
    .where(eq(workers.id, id))
    .returning();

  if (!updated) {
    return jsonError("Trabajador no encontrado.", 404);
  }

  return NextResponse.json(updated);
}
