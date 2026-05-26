import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import { jsonError } from "@/lib/http";

export async function GET() {
  const session = await requireAdminSession();
  if (!session) {
    return jsonError("No autorizado.", 401);
  }

  return NextResponse.json({
    id: session.sub,
    username: session.username
  });
}
