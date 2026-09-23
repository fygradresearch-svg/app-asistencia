import { NextResponse } from "next/server";
import { getWorkerByDni, isValidDni, normalizeDni } from "@/lib/worker-auth";
import { jsonError } from "@/lib/http";
import { createWorkerSessionToken, WORKER_SESSION_COOKIE } from "@/lib/session";
export async function POST(request: Request) { const body = await request.json().catch(() => null) as { dni?: string } | null; const dni = normalizeDni(body?.dni); if (!isValidDni(dni)) return jsonError("Ingresa un DNI válido.", 400); const worker = await getWorkerByDni(dni); if (!worker || worker.status !== "active") return jsonError("DNI no registrado o inactivo.", 401); const token = await createWorkerSessionToken({ sub: worker.id, dni: worker.dni }); const response = NextResponse.json({ ok: true }); response.cookies.set(WORKER_SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 43200 }); return response; }
