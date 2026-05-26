import { NextResponse } from "next/server";
import { getWorkerFromRequest } from "@/lib/worker-auth";
import { jsonError } from "@/lib/http";

export async function GET(request: Request) {
  const worker = await getWorkerFromRequest(request);
  if (!worker) {
    return jsonError("Token invalido o trabajador inactivo.", 401);
  }

  return NextResponse.json({
    id: worker.id,
    fullName: worker.fullName,
    status: worker.status,
    activatedAt: worker.activatedAt
  });
}
