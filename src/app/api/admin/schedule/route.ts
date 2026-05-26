import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { workSchedules } from "@/db/schema";
import { requireAdminSession } from "@/lib/auth";
import { getOrCreateSchedule } from "@/lib/data";
import { isTimeString, jsonError, parseNumber } from "@/lib/http";

export async function GET() {
  const session = await requireAdminSession();
  if (!session) {
    return jsonError("No autorizado.", 401);
  }

  const schedule = await getOrCreateSchedule();
  return NextResponse.json(schedule);
}

export async function PUT(request: Request) {
  const session = await requireAdminSession();
  if (!session) {
    return jsonError("No autorizado.", 401);
  }

  const body = (await request.json().catch(() => null)) as
    | {
        entryTime?: string;
        exitTime?: string;
        toleranceMinutes?: unknown;
      }
    | null;

  const entryTime = body?.entryTime;
  const exitTime = body?.exitTime;
  const toleranceMinutes = parseNumber(body?.toleranceMinutes);

  if (!isTimeString(entryTime) || !isTimeString(exitTime) || toleranceMinutes === null) {
    return jsonError("Completa el horario laboral.", 400);
  }

  if (toleranceMinutes < 0) {
    return jsonError("La tolerancia no puede ser negativa.", 400);
  }

  const existing = await getOrCreateSchedule();
  const [updated] = await db
    .update(workSchedules)
    .set({
      entryTime,
      exitTime,
      toleranceMinutes: Math.round(toleranceMinutes),
      updatedAt: new Date()
    })
    .where(eq(workSchedules.id, existing.id))
    .returning();

  return NextResponse.json(updated);
}
