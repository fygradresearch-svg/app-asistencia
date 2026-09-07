import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { workers, type WorkerType } from "@/db/schema";
import { requireAdminSession } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { recalculateAllAttendanceForWorker } from "@/lib/weekly-tolerance";

type UpdateWorkerBody = {
  workerType?: WorkerType;
};

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

  const body = (await request.json().catch(() => null)) as UpdateWorkerBody | null;
  const workerType = body?.workerType;

  if (workerType !== "worker" && workerType !== "intern") {
    return jsonError("Tipo de trabajador invalido.", 400);
  }

  const [updated] = await db
    .update(workers)
    .set({
      workerType,
      updatedAt: new Date()
    })
    .where(eq(workers.id, id))
    .returning({ id: workers.id, workerType: workers.workerType });

  if (!updated) {
    return jsonError("Trabajador no encontrado.", 404);
  }

  await recalculateAllAttendanceForWorker(id);

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
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

  const [deleted] = await db
    .delete(workers)
    .where(eq(workers.id, id))
    .returning({ id: workers.id });

  if (!deleted) {
    return jsonError("Trabajador no encontrado.", 404);
  }

  return NextResponse.json({ ok: true });
}
