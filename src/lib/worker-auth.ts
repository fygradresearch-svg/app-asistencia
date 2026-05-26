import { eq } from "drizzle-orm";
import { db } from "@/db";
import { workers } from "@/db/schema";
import { getBearerToken } from "@/lib/device-token";

export async function getWorkerFromRequest(request: Request) {
  const token = getBearerToken(request.headers);
  if (!token) {
    return null;
  }

  const [worker] = await db
    .select()
    .from(workers)
    .where(eq(workers.deviceToken, token))
    .limit(1);

  if (!worker || worker.status !== "active") {
    return null;
  }

  return worker;
}
