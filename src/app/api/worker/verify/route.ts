import { NextResponse } from "next/server";
import { jsonError, parseNumber } from "@/lib/http";
import { verifyWorkerAccess } from "@/lib/attendance-service";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { dni?: unknown; latitude?: unknown; longitude?: unknown }
    | null;

  const dni = typeof body?.dni === "string" ? body.dni : "";
  const latitude = parseNumber(body?.latitude);
  const longitude = parseNumber(body?.longitude);

  if (latitude === null || longitude === null) {
    return jsonError("La ubicacion GPS es requerida.", 400);
  }

  const result = await verifyWorkerAccess(dni, latitude, longitude);
  return NextResponse.json(result.body, { status: result.status });
}
