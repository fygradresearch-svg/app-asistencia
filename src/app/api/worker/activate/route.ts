import { and, eq, ne } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { workers } from "@/db/schema";
import { createDeviceToken } from "@/lib/device-token";
import { jsonError } from "@/lib/http";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { code?: string }
    | null;
  const code = body?.code?.trim();

  if (!code || !/^\d{4}$/.test(code)) {
    return jsonError("Ingresa un codigo de 4 digitos.", 400);
  }

  const deviceToken = createDeviceToken();
  const now = new Date();

  const [worker] = await db
    .update(workers)
    .set({
      deviceToken,
      codeUsed: true,
      status: "active",
      activatedAt: now,
      updatedAt: now
    })
    .where(
      and(
        eq(workers.activationCode, code),
        eq(workers.codeUsed, false),
        ne(workers.status, "inactive")
      )
    )
    .returning({
      id: workers.id,
      fullName: workers.fullName,
      status: workers.status,
      activatedAt: workers.activatedAt
    });

  if (!worker) {
    return jsonError("Codigo invalido, usado o trabajador inactivo.", 400);
  }

  return NextResponse.json({
    worker,
    deviceToken
  });
}
