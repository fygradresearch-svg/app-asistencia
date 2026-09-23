import { NextResponse } from "next/server";
import { verifyWorkerAccess } from "@/lib/attendance-service";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { dni?: unknown }
    | null;

  const dni = typeof body?.dni === "string" ? body.dni : "";
  const result = await verifyWorkerAccess(dni);
  return NextResponse.json(result.body, { status: result.status });
}
