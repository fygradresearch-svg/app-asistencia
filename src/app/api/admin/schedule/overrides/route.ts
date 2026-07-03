import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { db } from "@/db";
import { workerScheduleOverrides } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { recalculateWeeklyAttendance } from "@/lib/weekly-tolerance";

export async function GET(request: Request) {
  const session = await requireAdminSession();
  if (!session) {
    return jsonError("No autorizado.", 401);
  }

  const url = new URL(request.url);
  const workerIdStr = url.searchParams.get("workerId");
  const date = url.searchParams.get("date");

  if (!workerIdStr || !date) {
    return jsonError("workerId y date son requeridos.", 400);
  }

  const workerId = Number(workerIdStr);
  const [override] = await db
    .select()
    .from(workerScheduleOverrides)
    .where(
      and(
        eq(workerScheduleOverrides.workerId, workerId),
        eq(workerScheduleOverrides.date, date)
      )
    )
    .limit(1);

  return NextResponse.json(override ?? null);
}

export async function POST(request: Request) {
  const session = await requireAdminSession();
  if (!session) {
    return jsonError("No autorizado.", 401);
  }

  const body = (await request.json().catch(() => null)) as {
    workerId?: unknown;
    date?: unknown;
    morningEntryTime?: unknown;
    morningExitTime?: unknown;
    afternoonEntryTime?: unknown;
    afternoonExitTime?: unknown;
    toleranceMinutes?: unknown;
  } | null;

  const workerId = body?.workerId ? Number(body.workerId) : null;
  const date = typeof body?.date === "string" ? body.date.trim() : "";
  const morningEntryTime = typeof body?.morningEntryTime === "string" ? body.morningEntryTime.trim() || null : null;
  const morningExitTime = typeof body?.morningExitTime === "string" ? body.morningExitTime.trim() || null : null;
  const afternoonEntryTime = typeof body?.afternoonEntryTime === "string" ? body.afternoonEntryTime.trim() || null : null;
  const afternoonExitTime = typeof body?.afternoonExitTime === "string" ? body.afternoonExitTime.trim() || null : null;
  const toleranceMinutes = body?.toleranceMinutes !== undefined ? Number(body.toleranceMinutes) : 0;

  if (!workerId || !date) {
    return jsonError("workerId y date son requeridos.", 400);
  }

  // Format date and clean time inputs
  const cleanMorningEntry = morningEntryTime ? morningEntryTime.slice(0, 5) : null;
  const cleanMorningExit = morningExitTime ? morningExitTime.slice(0, 5) : null;
  const cleanAfternoonEntry = afternoonEntryTime ? afternoonEntryTime.slice(0, 5) : null;
  const cleanAfternoonExit = afternoonExitTime ? afternoonExitTime.slice(0, 5) : null;

  const [existing] = await db
    .select()
    .from(workerScheduleOverrides)
    .where(
      and(
        eq(workerScheduleOverrides.workerId, workerId),
        eq(workerScheduleOverrides.date, date)
      )
    )
    .limit(1);

  if (existing) {
    await db
      .update(workerScheduleOverrides)
      .set({
        morningEntryTime: cleanMorningEntry,
        morningExitTime: cleanMorningExit,
        afternoonEntryTime: cleanAfternoonEntry,
        afternoonExitTime: cleanAfternoonExit,
        toleranceMinutes,
        updatedAt: new Date()
      })
      .where(eq(workerScheduleOverrides.id, existing.id));
  } else {
    await db.insert(workerScheduleOverrides).values({
      workerId,
      date,
      morningEntryTime: cleanMorningEntry,
      morningExitTime: cleanMorningExit,
      afternoonEntryTime: cleanAfternoonEntry,
      afternoonExitTime: cleanAfternoonExit,
      toleranceMinutes
    });
  }

  // Recalculate attendance records for this date (if any)
  const targetDate = new Date(`${date}T12:00:00-05:00`);
  await recalculateWeeklyAttendance(workerId, targetDate);

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const session = await requireAdminSession();
  if (!session) {
    return jsonError("No autorizado.", 401);
  }

  const url = new URL(request.url);
  const workerIdStr = url.searchParams.get("workerId");
  const date = url.searchParams.get("date");

  if (!workerIdStr || !date) {
    return jsonError("workerId y date son requeridos.", 400);
  }

  const workerId = Number(workerIdStr);

  await db
    .delete(workerScheduleOverrides)
    .where(
      and(
        eq(workerScheduleOverrides.workerId, workerId),
        eq(workerScheduleOverrides.date, date)
      )
    );

  // Recalculate attendance records to fallback to normal weekly schedule
  const targetDate = new Date(`${date}T12:00:00-05:00`);
  await recalculateWeeklyAttendance(workerId, targetDate);

  return NextResponse.json({ ok: true });
}
