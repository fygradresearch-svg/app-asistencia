import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { workers } from "@/db/schema";
import { requireAdminSession } from "@/lib/auth";
import { generateUniqueActivationCode } from "@/lib/activation-code";
import { jsonError } from "@/lib/http";

export async function POST(
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

  const activationCode = await generateUniqueActivationCode();

  const [updated] = await db
    .update(workers)
    .set({
      activationCode,
      codeUsed: false,
      status: "pending",
      deviceToken: null,
      activatedAt: null,
      updatedAt: new Date()
    })
    .where(eq(workers.id, id))
    .returning();

  if (!updated) {
    return jsonError("Trabajador no encontrado.", 404);
  }

  return NextResponse.json(updated);
}
