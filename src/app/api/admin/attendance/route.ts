import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import { getAttendanceReportRows, getWorkerAttendanceTotals } from "@/lib/data";
import { jsonError } from "@/lib/http";
import { db } from "@/db";
import { shiftAttendanceRecords, workers } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { parseDateTimeInZone } from "@/lib/dates";
import { recalculateWeeklyAttendance } from "@/lib/weekly-tolerance";

export async function GET(request: Request) {
  const session = await requireAdminSession();
  if (!session) {
    return jsonError("No autorizado.", 401);
  }

  const url = new URL(request.url);
  const workerIdValue = url.searchParams.get("workerId");
  const workerId = workerIdValue ? Number(workerIdValue) : null;
  const filters = {
    date: url.searchParams.get("date"),
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
    workerId: Number.isInteger(workerId) ? workerId : null
  };

  const [rows, totals] = await Promise.all([
    getAttendanceReportRows(filters),
    getWorkerAttendanceTotals(filters)
  ]);

  return NextResponse.json({ rows, totals });
}

export async function POST(request: Request) {
  const session = await requireAdminSession();
  if (!session) {
    return jsonError("No autorizado.", 401);
  }

  const body = (await request.json().catch(() => null)) as {
    workerId?: unknown;
    date?: unknown;
    shiftType?: unknown;
    checkInTime?: unknown;
    checkOutTime?: unknown;
  } | null;

  const workerId = body?.workerId ? Number(body.workerId) : null;
  const date = typeof body?.date === "string" ? body.date.trim() : "";
  const shiftType = typeof body?.shiftType === "string" ? body.shiftType.trim() : "";
  const checkInTime = typeof body?.checkInTime === "string" ? body.checkInTime.trim() : "";
  const checkOutTime = typeof body?.checkOutTime === "string" ? body.checkOutTime.trim() : "";

  if (!workerId || !date || !shiftType || !checkInTime) {
    return jsonError("Datos incompletos.", 400);
  }

  if (shiftType !== "morning" && shiftType !== "afternoon") {
    return jsonError("Tipo de turno inválido.", 400);
  }

  // Fetch worker DNI
  const [worker] = await db
    .select()
    .from(workers)
    .where(eq(workers.id, workerId))
    .limit(1);

  if (!worker) {
    return jsonError("Trabajador no encontrado.", 404);
  }

  // Check if attendance already exists for worker, date, and shiftType
  const [existing] = await db
    .select()
    .from(shiftAttendanceRecords)
    .where(
      and(
        eq(shiftAttendanceRecords.workerId, workerId),
        eq(shiftAttendanceRecords.date, date),
        eq(shiftAttendanceRecords.shiftType, shiftType)
      )
    )
    .limit(1);

  if (existing) {
    return jsonError("Ya existe una asistencia registrada para este turno en la fecha elegida.", 409);
  }

  const checkInTimeDate = parseDateTimeInZone(date, checkInTime);
  const checkOutTimeDate = checkOutTime ? parseDateTimeInZone(date, checkOutTime) : null;

  const [inserted] = await db
    .insert(shiftAttendanceRecords)
    .values({
      workerId,
      dni: worker.dni,
      date,
      serverTime: checkInTimeDate,
      checkOutTime: checkOutTimeDate,
      shiftType,
      distanceMeters: 0,
      latitude: 0,
      longitude: 0,
      status: "punctual",
      lateMinutes: 0,
      fineAmountCents: 0,
      toleranceUsed: false
    })
    .returning();

  // Recalculate weekly penalties and tolerance for this worker
  await recalculateWeeklyAttendance(workerId, checkInTimeDate);

  return NextResponse.json({ ok: true, record: inserted });
}

export async function PATCH(request: Request) {
  const session = await requireAdminSession();
  if (!session) {
    return jsonError("No autorizado.", 401);
  }

  const body = (await request.json().catch(() => null)) as {
    id?: unknown;
    checkInTime?: unknown;
    checkOutTime?: unknown;
  } | null;

  const id = body?.id ? Number(body.id) : null;
  const checkInTime = typeof body?.checkInTime === "string" ? body.checkInTime.trim() : "";
  const checkOutTime = typeof body?.checkOutTime === "string" ? body.checkOutTime.trim() : "";

  if (!id || !checkInTime) {
    return jsonError("Datos incompletos.", 400);
  }

  const [record] = await db
    .select()
    .from(shiftAttendanceRecords)
    .where(eq(shiftAttendanceRecords.id, id))
    .limit(1);

  if (!record) {
    return jsonError("Registro de asistencia no encontrado.", 404);
  }

  const updatedServerTime = parseDateTimeInZone(record.date, checkInTime);
  const updatedCheckOutTime = checkOutTime ? parseDateTimeInZone(record.date, checkOutTime) : null;

  await db
    .update(shiftAttendanceRecords)
    .set({
      serverTime: updatedServerTime,
      checkOutTime: updatedCheckOutTime,
      updatedAt: new Date()
    })
    .where(eq(shiftAttendanceRecords.id, id));

  // Recalculate weekly penalties and tolerance chronological chain for this worker
  await recalculateWeeklyAttendance(record.workerId, updatedServerTime);

  return NextResponse.json({ ok: true });
}
