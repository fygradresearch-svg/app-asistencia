import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { workerDaySchedules, workers } from "@/db/schema";
import { requireAdminSession } from "@/lib/auth";
import { generateUniqueActivationCode } from "@/lib/activation-code";
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

type CreateWorkerBody = {
  fullName?: string;
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

export async function GET() {
  const session = await requireAdminSession();
  if (!session) {
    return jsonError("No autorizado.", 401);
  }

  const rows = await db.select().from(workers).orderBy(desc(workers.createdAt));
  const schedules = await db
    .select()
    .from(workerDaySchedules)
    .orderBy(workerDaySchedules.workerId, workerDaySchedules.weekday);

  return NextResponse.json(
    rows.map((worker) => ({
      ...worker,
      daySchedules: schedules.filter((schedule) => schedule.workerId === worker.id)
    }))
  );
}

export async function POST(request: Request) {
  const session = await requireAdminSession();
  if (!session) {
    return jsonError("No autorizado.", 401);
  }

  const body = (await request.json().catch(() => null)) as CreateWorkerBody | null;
  const fullName = body?.fullName?.trim();
  let daySchedules: ReturnType<typeof normalizeDaySchedules> = [];

  try {
    daySchedules = normalizeDaySchedules(body?.daySchedules);
  } catch {
    return jsonError("Completa correctamente los horarios de lunes a viernes.", 400);
  }

  const hasCustomSchedule =
    daySchedules.length === 0 &&
    (Boolean(body?.scheduleEntryTime) ||
      Boolean(body?.scheduleExitTime) ||
      body?.scheduleToleranceMinutes !== undefined);
  const scheduleEntryTime = body?.scheduleEntryTime ?? null;
  const scheduleExitTime = body?.scheduleExitTime ?? null;
  const scheduleToleranceMinutes = parseNumber(body?.scheduleToleranceMinutes);

  if (!fullName || fullName.length < 3) {
    return jsonError("Ingresa el nombre completo del trabajador.", 400);
  }

  if (hasCustomSchedule) {
    if (
      !isTimeString(scheduleEntryTime) ||
      !isTimeString(scheduleExitTime) ||
      scheduleToleranceMinutes === null ||
      scheduleToleranceMinutes < 0
    ) {
      return jsonError("Completa correctamente el horario propio del trabajador.", 400);
    }
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const activationCode = await generateUniqueActivationCode();

    try {
      const [created] = await db
        .insert(workers)
        .values({
          fullName,
          activationCode,
          codeUsed: false,
          status: "pending",
          scheduleEntryTime: hasCustomSchedule ? scheduleEntryTime : null,
          scheduleExitTime: hasCustomSchedule ? scheduleExitTime : null,
          scheduleToleranceMinutes: hasCustomSchedule
            ? Math.round(scheduleToleranceMinutes ?? 0)
            : null,
          updatedAt: new Date()
        })
        .returning();

      if (daySchedules.length) {
        await db.insert(workerDaySchedules).values(
          daySchedules.map((schedule) => ({
            workerId: created.id,
            ...schedule,
            updatedAt: new Date()
          }))
        );
      }

      return NextResponse.json(created, { status: 201 });
    } catch (error) {
      if (attempt === 4) {
        throw error;
      }
    }
  }

  return jsonError("No se pudo crear el trabajador.", 500);
}
