import { and, count, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  attendanceRecords,
  locations,
  workers,
  workSchedules
} from "@/db/schema";
import { DEFAULT_LOCATION, DEFAULT_SCHEDULE } from "@/lib/defaults";
import { getBusinessDate } from "@/lib/dates";

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
    .from(attendanceRecords)
    .where(eq(attendanceRecords.date, today));
  const [todayLate] = await db
    .select({ value: count() })
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.date, today),
        eq(attendanceRecords.attendanceStatus, "late")
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

export async function getAttendanceReportRows(filters: AttendanceFilters) {
  const conditions = [];

  if (filters.date) {
    conditions.push(eq(attendanceRecords.date, filters.date));
  } else {
    if (filters.from) {
      conditions.push(gte(attendanceRecords.date, filters.from));
    }
    if (filters.to) {
      conditions.push(lte(attendanceRecords.date, filters.to));
    }
  }

  if (filters.workerId) {
    conditions.push(eq(attendanceRecords.workerId, filters.workerId));
  }

  const query = db
    .select({
      id: attendanceRecords.id,
      workerId: attendanceRecords.workerId,
      workerName: workers.fullName,
      date: attendanceRecords.date,
      checkInTime: attendanceRecords.checkInTime,
      checkOutTime: attendanceRecords.checkOutTime,
      checkInLatitude: attendanceRecords.checkInLatitude,
      checkInLongitude: attendanceRecords.checkInLongitude,
      checkOutLatitude: attendanceRecords.checkOutLatitude,
      checkOutLongitude: attendanceRecords.checkOutLongitude,
      checkInDistanceMeters: attendanceRecords.checkInDistanceMeters,
      checkOutDistanceMeters: attendanceRecords.checkOutDistanceMeters,
      gpsStatus: attendanceRecords.gpsStatus,
      attendanceStatus: attendanceRecords.attendanceStatus,
      createdAt: attendanceRecords.createdAt
    })
    .from(attendanceRecords)
    .innerJoin(workers, eq(workers.id, attendanceRecords.workerId));

  const condition = conditions.length ? and(...conditions) : undefined;

  if (condition) {
    return query
      .where(condition)
      .orderBy(desc(attendanceRecords.date), desc(attendanceRecords.createdAt));
  }

  return query.orderBy(desc(attendanceRecords.date), desc(attendanceRecords.createdAt));
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
