import { and, count, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  locations,
  shiftAttendanceRecords,
  workers,
  workSchedules
} from "@/db/schema";
import { DEFAULT_LOCATION, DEFAULT_SCHEDULE } from "@/lib/defaults";
import { getBusinessDate } from "@/lib/dates";
import { formatFineAmount } from "@/lib/penalties";

export async function getCurrentLocation() {
  const [location] = await db.select().from(locations).limit(1);
  return location ?? null;
}

export async function getOrCreateLocation() {
  const existing = await getCurrentLocation();
  if (existing) {
    return existing;
  }
  const [created] = await db.insert(locations).values(DEFAULT_LOCATION).returning();
  return created;
}

export async function getCurrentSchedule() {
  const [schedule] = await db.select().from(workSchedules).limit(1);
  return schedule ?? null;
}

export async function getOrCreateSchedule() {
  const existing = await getCurrentSchedule();
  if (existing) {
    return existing;
  }
  const [created] = await db.insert(workSchedules).values(DEFAULT_SCHEDULE).returning();
  return created;
}

export async function getDashboardStats() {
  const today = getBusinessDate();
  const [registered] = await db.select({ value: count() }).from(workers);
  const [active] = await db
    .select({ value: count() })
    .from(workers)
    .where(eq(workers.status, "active"));
  const [todayAttendance] = await db
    .select({ value: count() })
    .from(shiftAttendanceRecords)
    .where(eq(shiftAttendanceRecords.date, today));
  const [todayLate] = await db
    .select({ value: count() })
    .from(shiftAttendanceRecords)
    .where(
      and(
        eq(shiftAttendanceRecords.date, today),
        eq(shiftAttendanceRecords.status, "late")
      )
    );

  return {
    registeredWorkers: registered?.value ?? 0,
    activeWorkers: active?.value ?? 0,
    todayAttendance: todayAttendance?.value ?? 0,
    todayLate: todayLate?.value ?? 0
  };
}

export type AttendanceFilters = {
  date?: string | null;
  from?: string | null;
  to?: string | null;
  workerId?: number | null;
};

export type AttendanceReportRow = {
  id: number;
  workerId: number;
  workerName: string;
  workerDni: string;
  date: string;
  shiftType: "morning" | "afternoon";
  serverTime: Date;
  checkOutTime: Date | null;
  status: string;
  lateMinutes: number;
  fineAmountCents: number;
  toleranceUsed: boolean;
  distanceMeters: number;
};

export type WorkerAttendanceTotals = {
  workerId: number;
  workerName: string;
  workerDni: string;
  totalLate: number;
  totalAbsent: number;
  totalFinesCents: number;
};

export async function getAttendanceReportRows(filters: AttendanceFilters) {
  const conditions = [];

  if (filters.date) {
    conditions.push(eq(shiftAttendanceRecords.date, filters.date));
  } else {
    if (filters.from) {
      conditions.push(gte(shiftAttendanceRecords.date, filters.from));
    }
    if (filters.to) {
      conditions.push(lte(shiftAttendanceRecords.date, filters.to));
    }
  }

  if (filters.workerId) {
    conditions.push(eq(shiftAttendanceRecords.workerId, filters.workerId));
  }

  const query = db
    .select({
      id: shiftAttendanceRecords.id,
      workerId: shiftAttendanceRecords.workerId,
      workerName: workers.fullName,
      workerDni: shiftAttendanceRecords.dni,
      date: shiftAttendanceRecords.date,
      shiftType: shiftAttendanceRecords.shiftType,
      serverTime: shiftAttendanceRecords.serverTime,
      checkOutTime: shiftAttendanceRecords.checkOutTime,
      status: shiftAttendanceRecords.status,
      lateMinutes: shiftAttendanceRecords.lateMinutes,
      fineAmountCents: shiftAttendanceRecords.fineAmountCents,
      toleranceUsed: shiftAttendanceRecords.toleranceUsed,
      distanceMeters: shiftAttendanceRecords.distanceMeters
    })
    .from(shiftAttendanceRecords)
    .innerJoin(workers, eq(workers.id, shiftAttendanceRecords.workerId));

  const condition = conditions.length ? and(...conditions) : undefined;

  if (condition) {
    return query
      .where(condition)
      .orderBy(
        desc(shiftAttendanceRecords.date),
        sql`lower(${workers.fullName})`,
        shiftAttendanceRecords.shiftType
      );
  }

  return query.orderBy(
    desc(shiftAttendanceRecords.date),
    sql`lower(${workers.fullName})`,
    shiftAttendanceRecords.shiftType
  );
}

export async function getWorkerAttendanceTotals(filters: AttendanceFilters) {
  const rows = await getAttendanceReportRows(filters);
  const totalsMap = new Map<number, WorkerAttendanceTotals>();

  for (const row of rows) {
    const current = totalsMap.get(row.workerId) ?? {
      workerId: row.workerId,
      workerName: row.workerName,
      workerDni: row.workerDni,
      totalLate: 0,
      totalAbsent: 0,
      totalFinesCents: 0
    };

    if (row.status === "late") {
      current.totalLate += 1;
    }

    if (row.status === "absent") {
      current.totalAbsent += 1;
    }

    current.totalFinesCents += row.fineAmountCents;
    totalsMap.set(row.workerId, current);
  }

  return Array.from(totalsMap.values()).sort((left, right) =>
    left.workerName.localeCompare(right.workerName, "es")
  );
}

export function formatReportFineLabel(fineAmountCents: number) {
  return fineAmountCents ? formatFineAmount(fineAmountCents) : "Sin multa";
}

export async function getWorkerOptions() {
  return db
    .select({
      id: workers.id,
      fullName: workers.fullName
    })
    .from(workers)
    .orderBy(sql`lower(${workers.fullName})`);
}
