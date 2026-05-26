import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { admins } from "@/db/schema";
import { jsonError } from "@/lib/http";
import {
  ADMIN_SESSION_COOKIE,
  createAdminSessionToken
} from "@/lib/session";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { username?: string; password?: string }
    | null;

  const username = body?.username?.trim();
  const password = body?.password ?? "";

  if (!username || !password) {
    return jsonError("Usuario y contrasena son requeridos.", 400);
  }

  const [admin] = await db
    .select()
    .from(admins)
    .where(eq(admins.username, username))
    .limit(1);

  if (!admin) {
    return jsonError("Credenciales invalidas.", 401);
  }

  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) {
    return jsonError("Credenciales invalidas.", 401);
  }

  const token = await createAdminSessionToken({
    sub: admin.id,
    username: admin.username
  });

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8
  });

  return NextResponse.json({ ok: true });
}
