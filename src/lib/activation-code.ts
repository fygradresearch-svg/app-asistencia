import { eq } from "drizzle-orm";
import { db } from "@/db";
import { workers } from "@/db/schema";

function randomActivationCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export async function generateUniqueActivationCode() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const code = randomActivationCode();
    const existing = await db
      .select({ id: workers.id })
      .from(workers)
      .where(eq(workers.activationCode, code))
      .limit(1);

    if (existing.length === 0) {
      return code;
    }
  }

  throw new Error("No se pudo generar un codigo unico.");
}
