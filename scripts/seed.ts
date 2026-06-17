import { config as loadEnv } from "dotenv";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { admins, locations, workers, workSchedules } from "../src/db/schema";
import { DEFAULT_LOCATION, DEFAULT_SCHEDULE } from "../src/lib/defaults";

loadEnv({ path: ".env.local" });
loadEnv();

type AppDb = typeof import("../src/db").db;

const seedWorkersData = [
  { fullName: "Juan Perez", dni: "12345678" },
  { fullName: "Maria Lopez", dni: "87654321" },
  { fullName: "Carlos Ramos", dni: "11223344" }
];

async function seedAdmin(db: AppDb) {
  const passwordHash = await bcrypt.hash("admin123", 10);

  await db
    .insert(admins)
    .values({
      username: "admin",
      passwordHash
    })
    .onConflictDoUpdate({
      target: admins.username,
      set: { passwordHash }
    });
}

async function seedLocation(db: AppDb) {
  const [existing] = await db.select().from(locations).limit(1);

  if (existing) {
    await db
      .update(locations)
      .set({ ...DEFAULT_LOCATION, updatedAt: new Date() })
      .where(eq(locations.id, existing.id));
    return;
  }

  await db.insert(locations).values(DEFAULT_LOCATION);
}

async function seedSchedule(db: AppDb) {
  const [existing] = await db.select().from(workSchedules).limit(1);

  if (existing) {
    await db
      .update(workSchedules)
      .set({ ...DEFAULT_SCHEDULE, updatedAt: new Date() })
      .where(eq(workSchedules.id, existing.id));
    return;
  }

  await db.insert(workSchedules).values(DEFAULT_SCHEDULE);
}

async function seedWorkers(db: AppDb) {
  for (const worker of seedWorkersData) {
    const [existing] = await db
      .select({ id: workers.id })
      .from(workers)
      .where(eq(workers.dni, worker.dni))
      .limit(1);

    if (existing) {
      continue;
    }

    await db.insert(workers).values({
      fullName: worker.fullName,
      dni: worker.dni,
      status: "active",
      updatedAt: new Date()
    });
  }
}

async function main() {
  const { db } = await import("../src/db");

  await seedAdmin(db);
  await seedLocation(db);
  await seedSchedule(db);
  await seedWorkers(db);
  console.log("Seed completado.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
