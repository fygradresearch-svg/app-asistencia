import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { workerDaySchedules, workers } from "@/db/schema";
import { requireAdminSession } from "@/lib/auth";
import { isValidDni, normalizeDni } from "@/lib/worker-auth";
import { jsonError } from "@/lib/http";
import { normalizeDaySchedules, type DayScheduleInput } from "@/lib/schedule-input";

type CreateWorkerBody = {
  fullName?: string;
  dni?: string;
  scheduleEntryTime?: string | null;
  scheduleExitTime?: string | null;
  scheduleToleranceMinutes?: unknown;
  daySchedules?: DayScheduleInput[];
};

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
  const dni = normalizeDni(body?.dni);
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
  const scheduleToleranceMinutes =
    body?.scheduleToleranceMinutes === undefined ? null : Number(body.scheduleToleranceMinutes);

  if (!fullName || fullName.length < 3) {
    return jsonError("Ingresa el nombre completo del trabajador.", 400);
  }

  if (!isValidDni(dni)) {
    return jsonError("Ingresa un DNI valido de 8 digitos.", 400);
  }

  if (hasCustomSchedule) {
    if (
      !scheduleEntryTime ||
      !scheduleExitTime ||
      scheduleToleranceMinutes === null ||
      Number.isNaN(scheduleToleranceMinutes) ||
      scheduleToleranceMinutes < 0
    ) {
      return jsonError("Completa correctamente el horario propio del trabajador.", 400);
    }
  }

  const [existingDni] = await db.select().from(workers).where(eq(workers.dni, dni)).limit(1);
  if (existingDni) {
    return jsonError("Ya existe un trabajador con ese DNI.", 409);
  }

  const [created] = await db
    .insert(workers)
    .values({
      fullName,
      dni,
      status: "active",
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
}
