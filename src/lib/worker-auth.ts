import { eq } from "drizzle-orm";
import { db } from "@/db";
import { cookies } from "next/headers";
import { WORKER_SESSION_COOKIE, verifyWorkerSessionToken } from "@/lib/session";
import { workers } from "@/db/schema";

const DNI_PATTERN = /^\d{8}$/;

export function normalizeDni(value: string | undefined | null) {
  return value?.trim() ?? "";
}

export function isValidDni(value: string) {
  return DNI_PATTERN.test(value);
}

export async function getWorkerByDni(dni: string) {
  const normalized = normalizeDni(dni);
  if (!isValidDni(normalized)) {
    return null;
  }

  const [worker] = await db
    .select()
    .from(workers)
    .where(eq(workers.dni, normalized))
    .limit(1);

  return worker ?? null;
}

export async function requireWorkerSession() {
  const token = (await cookies()).get(WORKER_SESSION_COOKIE)?.value;
  return token ? verifyWorkerSessionToken(token) : null;
}
