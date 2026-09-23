import { NextResponse } from "next/server"; import { WORKER_SESSION_COOKIE } from "@/lib/session";
export async function POST() { const response = NextResponse.json({ ok: true }); response.cookies.set(WORKER_SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 }); return response; }
