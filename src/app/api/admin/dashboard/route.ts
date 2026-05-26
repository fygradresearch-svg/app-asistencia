import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import { getDashboardStats } from "@/lib/data";
import { jsonError } from "@/lib/http";

export async function GET() {
  const session = await requireAdminSession();
  if (!session) {
    return jsonError("No autorizado.", 401);
  }

  const stats = await getDashboardStats();
  return NextResponse.json(stats);
}
