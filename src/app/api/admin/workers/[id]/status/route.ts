import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { workers, type WorkerStatus } from "@/db/schema";
import { requireAdminSession } from "@/lib/auth";
import { jsonError } from "@/lib/http";

const allowedStatuses: WorkerStatus[] = ["active", "inactive"];

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

  const body = (await request.json().catch(() => null)) as
    | { status?: WorkerStatus }
    | null;
  const status = body?.status;

  if (!status || !allowedStatuses.includes(status)) {
    return jsonError("Estado invalido.", 400);
  }

  const [updated] = await db
    .update(workers)
    .set({ status, updatedAt: new Date() })
    .where(eq(workers.id, id))
    .returning();

  if (!updated) {
    return jsonError("Trabajador no encontrado.", 404);
  }

  return NextResponse.json(updated);
}
