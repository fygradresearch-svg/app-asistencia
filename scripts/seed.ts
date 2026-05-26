import { config as loadEnv } from "dotenv";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { admins, locations, workers, workSchedules } from "../src/db/schema";
import { DEFAULT_LOCATION, DEFAULT_SCHEDULE } from "../src/lib/defaults";

loadEnv({ path: ".env.local" });
loadEnv();

type AppDb = typeof import("../src/db").db;
type CodeGenerator = typeof import("../src/lib/activation-code").generateUniqueActivationCode;

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

async function seedWorkers(db: AppDb, generateUniqueActivationCode: CodeGenerator) {
  const names = ["Juan Perez", "Maria Lopez", "Carlos Ramos"];

  for (const fullName of names) {
    const [existing] = await db
      .select({ id: workers.id })
      .from(workers)
      .where(eq(workers.fullName, fullName))
      .limit(1);

    if (existing) {
      continue;
    }

    await db.insert(workers).values({
      fullName,
      activationCode: await generateUniqueActivationCode(),
      codeUsed: false,
      status: "pending",
      updatedAt: new Date()
    });
  }
}

async function main() {
  const [{ db }, { generateUniqueActivationCode }] = await Promise.all([
    import("../src/db"),
    import("../src/lib/activation-code")
  ]);

  await seedAdmin(db);
  await seedLocation(db);
  await seedSchedule(db);
  await seedWorkers(db, generateUniqueActivationCode);
  console.log("Seed completado.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
