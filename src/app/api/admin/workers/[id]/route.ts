import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { workers } from "@/db/schema";
import { requireAdminSession } from "@/lib/auth";
import { jsonError } from "@/lib/http";

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
