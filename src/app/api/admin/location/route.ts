import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { locations } from "@/db/schema";
import { requireAdminSession } from "@/lib/auth";
import { getOrCreateLocation } from "@/lib/data";
import { jsonError, parseNumber } from "@/lib/http";

export async function GET() {
  const session = await requireAdminSession();
  if (!session) {
    return jsonError("No autorizado.", 401);
  }

  const location = await getOrCreateLocation();
  return NextResponse.json(location);
}

export async function PUT(request: Request) {
  const session = await requireAdminSession();
  if (!session) {
    return jsonError("No autorizado.", 401);
  }

  const body = (await request.json().catch(() => null)) as
    | {
        name?: string;
        latitude?: unknown;
        longitude?: unknown;
        allowedRadiusMeters?: unknown;
      }
    | null;

  const name = body?.name?.trim();
  const latitude = parseNumber(body?.latitude);
  const longitude = parseNumber(body?.longitude);
  const allowedRadiusMeters = parseNumber(body?.allowedRadiusMeters);

  if (!name || latitude === null || longitude === null || allowedRadiusMeters === null) {
    return jsonError("Completa todos los datos de ubicacion.", 400);
  }

  if (allowedRadiusMeters <= 0) {
    return jsonError("El radio permitido debe ser mayor que cero.", 400);
  }

  const existing = await getOrCreateLocation();
  const [updated] = await db
    .update(locations)
    .set({
      name,
      latitude,
      longitude,
      allowedRadiusMeters: Math.round(allowedRadiusMeters),
      updatedAt: new Date()
    })
    .where(eq(locations.id, existing.id))
    .returning();

  return NextResponse.json(updated);
}
