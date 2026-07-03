import { NextResponse } from "next/server";
import { jsonError, parseNumber } from "@/lib/http";
import { markAttendance } from "@/lib/attendance-service";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { dni?: unknown; latitude?: unknown; longitude?: unknown; deviceFingerprint?: unknown }
    | null;

  const dni = typeof body?.dni === "string" ? body.dni : "";
  const latitude = parseNumber(body?.latitude);
  const longitude = parseNumber(body?.longitude);
  const deviceFingerprint = typeof body?.deviceFingerprint === "string" ? body.deviceFingerprint : "";

  if (latitude === null || longitude === null) {
    return jsonError("La ubicacion GPS es requerida.", 400);
  }

  const userAgent = request.headers.get("user-agent") || "";
  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "127.0.0.1";

  const result = await markAttendance({
    dni,
    type: "check_in",
    latitude,
    longitude,
    deviceFingerprint,
    ipAddress,
    userAgent
  });

  return NextResponse.json(result.body, { status: result.status });
}
