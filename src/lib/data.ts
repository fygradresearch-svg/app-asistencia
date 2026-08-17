import { and, count, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import {
  locations,
  shiftAttendanceRecords,
  workerDaySchedules,
  workerScheduleOverrides,
  workers,
  workSchedules,
  type WorkerDaySchedule,
  type WorkerScheduleOverride
} from "@/db/schema";
import { DEFAULT_LOCATION, DEFAULT_SCHEDULE } from "@/lib/defaults";
import { getBusinessDate, getBusinessTime } from "@/lib/dates";
import { formatFineAmount } from "@/lib/penalties";
import { DayShiftSchedule } from "@/lib/worker-schedules";

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
  id: number | null;
  workerId: number;
  workerName: string;
  workerDni: string;
  date: string;
  shiftType: "morning" | "afternoon";
  scheduledEntryTime: string | null;
  serverTime: Date | null;
  checkOutTime: Date | null;
  status: string;
  lateMinutes: number;
  fineAmountCents: number;
  toleranceUsed: boolean;
  distanceMeters: number;
  canEdit: boolean;
  deviceFingerprint: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  checkOutFingerprint: string | null;
  checkOutIp: string | null;
  checkOutUserAgent: string | null;
};

export type WorkerAttendanceTotals = {
  workerId: number;
  workerName: string;
  workerDni: string;
  totalLate: number;
  totalAbsent: number;
  totalFinesCents: number;
};

type WorkerReportSource = {
  id: number;
  fullName: string;
  dni: string;
  status: "pending" | "active" | "inactive";
  scheduleEntryTime: string | null;
  scheduleExitTime: string | null;
  scheduleToleranceMinutes: number | null;
};

function parseDateParts(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

function getWeekdayFromDateString(value: string) {
  const { year, month, day } = parseDateParts(value);
  const utcDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return utcDay === 0 ? 7 : utcDay;
}

function enumerateDates(start: string, end: string) {
  const startParts = parseDateParts(start);
  const endParts = parseDateParts(end);
  const current = new Date(Date.UTC(startParts.year, startParts.month - 1, startParts.day));
  const last = new Date(Date.UTC(endParts.year, endParts.month - 1, endParts.day));
  const dates: string[] = [];

  while (current <= last) {
    const year = current.getUTCFullYear();
    const month = String(current.getUTCMonth() + 1).padStart(2, "0");
    const day = String(current.getUTCDate()).padStart(2, "0");
    dates.push(`${year}-${month}-${day}`);
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}

function compareShiftType(
  left: AttendanceReportRow["shiftType"],
  right: AttendanceReportRow["shiftType"]
) {
  const order = { morning: 0, afternoon: 1 };
  return order[left] - order[right];
}

function sortAttendanceRows(rows: AttendanceReportRow[]) {
  return rows.sort((left, right) => {
    if (left.date !== right.date) {
      return right.date.localeCompare(left.date);
    }

    const nameCompare = left.workerName.localeCompare(right.workerName, "es", {
      sensitivity: "base"
    });
    if (nameCompare !== 0) {
      return nameCompare;
    }

    return compareShiftType(left.shiftType, right.shiftType);
  });
}

function buildFallbackSchedule(
  worker: WorkerReportSource,
  globalSchedule: Awaited<ReturnType<typeof getCurrentSchedule>>
): DayShiftSchedule {
  return {
    morningEntryTime: worker.scheduleEntryTime ?? globalSchedule?.entryTime ?? "08:00",
    morningExitTime: "13:00",
    afternoonEntryTime: "14:30",
    afternoonExitTime: worker.scheduleExitTime ?? globalSchedule?.exitTime ?? "19:00",
    toleranceMinutes:
      worker.scheduleToleranceMinutes ?? globalSchedule?.toleranceMinutes ?? 0
  };
}

function resolveScheduleForDate({
  worker,
  date,
  globalSchedule,
  daySchedulesByWorker,
  overridesByWorkerDate
}: {
  worker: WorkerReportSource;
  date: string;
  globalSchedule: Awaited<ReturnType<typeof getCurrentSchedule>>;
  daySchedulesByWorker: Map<number, Map<number, WorkerDaySchedule>>;
  overridesByWorkerDate: Map<string, WorkerScheduleOverride>;
}) {
  const override = overridesByWorkerDate.get(`${worker.id}:${date}`);
  if (override) {
    return {
      morningEntryTime: override.morningEntryTime,
      morningExitTime: override.morningExitTime,
      afternoonEntryTime: override.afternoonEntryTime,
      afternoonExitTime: override.afternoonExitTime,
      toleranceMinutes: override.toleranceMinutes
    } satisfies DayShiftSchedule;
  }

  const workerDayMap = daySchedulesByWorker.get(worker.id);
  if (workerDayMap?.size) {
    const weekday = getWeekdayFromDateString(date);
    const daySchedule = workerDayMap.get(weekday);

    if (!daySchedule) {
      return null;
    }

    const hasStoredShiftFields = Boolean(
      daySchedule.morningEntryTime ||
        daySchedule.morningExitTime ||
        daySchedule.afternoonEntryTime ||
        daySchedule.afternoonExitTime
    );

    if (!hasStoredShiftFields) {
      return {
        morningEntryTime: daySchedule.entryTime,
        morningExitTime: "13:00",
        afternoonEntryTime: "14:30",
        afternoonExitTime: daySchedule.exitTime,
        toleranceMinutes: daySchedule.toleranceMinutes
      } satisfies DayShiftSchedule;
    }

    return {
      morningEntryTime: daySchedule.morningEntryTime,
      morningExitTime: daySchedule.morningExitTime,
      afternoonEntryTime: daySchedule.afternoonEntryTime,
      afternoonExitTime: daySchedule.afternoonExitTime,
      toleranceMinutes: daySchedule.toleranceMinutes
    } satisfies DayShiftSchedule;
  }

  return buildFallbackSchedule(worker, globalSchedule);
}

function shouldMarkAbsent(date: string, scheduledEntryTime: string | null) {
  if (!scheduledEntryTime) {
    return false;
  }

  const today = getBusinessDate();
  if (date < today) {
    return true;
  }

  if (date > today) {
    return false;
  }

  return getBusinessTime().slice(0, 5) >= scheduledEntryTime.slice(0, 5);
}

function mapRecordRow(
  row: Awaited<ReturnType<typeof getAttendanceRecordRows>>[number],
  scheduledEntryTime: string | null
): AttendanceReportRow {
  return {
    id: row.id,
    workerId: row.workerId,
    workerName: row.workerName,
    workerDni: row.workerDni,
    date: row.date,
    shiftType: row.shiftType,
    scheduledEntryTime,
    serverTime: row.serverTime,
    checkOutTime: row.checkOutTime,
    status: row.status,
    lateMinutes: row.lateMinutes,
    fineAmountCents: row.fineAmountCents,
    toleranceUsed: row.toleranceUsed,
    distanceMeters: row.distanceMeters,
    canEdit: true,
    deviceFingerprint: row.deviceFingerprint,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    checkOutFingerprint: row.checkOutFingerprint,
    checkOutIp: row.checkOutIp,
    checkOutUserAgent: row.checkOutUserAgent
  };
}

async function getAttendanceRecordRows(filters: AttendanceFilters) {
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
      distanceMeters: shiftAttendanceRecords.distanceMeters,
      deviceFingerprint: shiftAttendanceRecords.deviceFingerprint,
      ipAddress: shiftAttendanceRecords.ipAddress,
      userAgent: shiftAttendanceRecords.userAgent,
      checkOutFingerprint: shiftAttendanceRecords.checkOutFingerprint,
      checkOutIp: shiftAttendanceRecords.checkOutIp,
      checkOutUserAgent: shiftAttendanceRecords.checkOutUserAgent
    })
    .from(shiftAttendanceRecords)
    .innerJoin(workers, eq(workers.id, shiftAttendanceRecords.workerId));

  const condition = conditions.length ? and(...conditions) : undefined;

  if (condition) {
    return query.where(condition);
  }

  return query;
}

export async function getAttendanceReportRows(filters: AttendanceFilters) {
  const recordRows = await getAttendanceRecordRows(filters);
  const shouldBuildExpectedShifts = Boolean(filters.date || filters.from || filters.to);

  if (!shouldBuildExpectedShifts) {
    return sortAttendanceRows(recordRows.map((row) => mapRecordRow(row, null)));
  }

  const rangeStart = filters.date ?? filters.from ?? filters.to;
  const rangeEnd = filters.date ?? filters.to ?? filters.from;

  if (!rangeStart || !rangeEnd) {
    return sortAttendanceRows(recordRows.map((row) => mapRecordRow(row, null)));
  }

  const [globalSchedule, activeWorkers] = await Promise.all([
    getCurrentSchedule(),
    db
      .select({
        id: workers.id,
        fullName: workers.fullName,
        dni: workers.dni,
        status: workers.status,
        scheduleEntryTime: workers.scheduleEntryTime,
        scheduleExitTime: workers.scheduleExitTime,
        scheduleToleranceMinutes: workers.scheduleToleranceMinutes
      })
      .from(workers)
      .where(
        and(
          eq(workers.status, "active"),
          ...(filters.workerId ? [eq(workers.id, filters.workerId)] : [])
        )
      )
  ]);

  if (activeWorkers.length === 0) {
    return sortAttendanceRows(recordRows.map((row) => mapRecordRow(row, null)));
  }

  const workerIds = activeWorkers.map((worker) => worker.id);
  const dates = enumerateDates(rangeStart, rangeEnd);

  const [daySchedules, overrides] = await Promise.all([
    db
      .select()
      .from(workerDaySchedules)
      .where(inArray(workerDaySchedules.workerId, workerIds)),
    db
      .select()
      .from(workerScheduleOverrides)
      .where(
        and(
          inArray(workerScheduleOverrides.workerId, workerIds),
          gte(workerScheduleOverrides.date, rangeStart),
          lte(workerScheduleOverrides.date, rangeEnd)
        )
      )
  ]);

  const daySchedulesByWorker = new Map<number, Map<number, WorkerDaySchedule>>();
  for (const daySchedule of daySchedules) {
    const workerMap = daySchedulesByWorker.get(daySchedule.workerId) ?? new Map();
    workerMap.set(daySchedule.weekday, daySchedule);
    daySchedulesByWorker.set(daySchedule.workerId, workerMap);
  }

  const overridesByWorkerDate = new Map<string, WorkerScheduleOverride>();
  for (const override of overrides) {
    overridesByWorkerDate.set(`${override.workerId}:${override.date}`, override);
  }

  const rowsByKey = new Map<string, AttendanceReportRow>();

  for (const row of recordRows) {
    const worker = activeWorkers.find((item) => item.id === row.workerId) ?? null;
    const schedule = worker
      ? resolveScheduleForDate({
          worker,
          date: row.date,
          globalSchedule,
          daySchedulesByWorker,
          overridesByWorkerDate
        })
      : null;
    const scheduledEntryTime =
      row.shiftType === "morning" ? schedule?.morningEntryTime ?? null : schedule?.afternoonEntryTime ?? null;
    rowsByKey.set(
      `${row.workerId}:${row.date}:${row.shiftType}`,
      mapRecordRow(row, scheduledEntryTime)
    );
  }

  for (const worker of activeWorkers) {
    for (const date of dates) {
      if (getWeekdayFromDateString(date) === 7) {
        continue;
      }

      const schedule = resolveScheduleForDate({
        worker,
        date,
        globalSchedule,
        daySchedulesByWorker,
        overridesByWorkerDate
      });

      if (!schedule) {
        continue;
      }

      const expectedShifts: Array<AttendanceReportRow["shiftType"]> = [];
      if (schedule.morningEntryTime && schedule.morningExitTime) {
        expectedShifts.push("morning");
      }
      if (schedule.afternoonEntryTime && schedule.afternoonExitTime) {
        expectedShifts.push("afternoon");
      }

      for (const shiftType of expectedShifts) {
        const key = `${worker.id}:${date}:${shiftType}`;
        if (rowsByKey.has(key)) {
          continue;
        }

        const scheduledEntryTime =
          shiftType === "morning" ? schedule.morningEntryTime : schedule.afternoonEntryTime;

        if (!shouldMarkAbsent(date, scheduledEntryTime)) {
          continue;
        }

        rowsByKey.set(key, {
          id: null,
          workerId: worker.id,
          workerName: worker.fullName,
          workerDni: worker.dni,
          date,
          shiftType,
          scheduledEntryTime,
          serverTime: null,
          checkOutTime: null,
          status: "absent",
          lateMinutes: 0,
          fineAmountCents: 0,
          toleranceUsed: false,
          distanceMeters: 0,
          canEdit: false,
          deviceFingerprint: null,
          ipAddress: null,
          userAgent: null,
          checkOutFingerprint: null,
          checkOutIp: null,
          checkOutUserAgent: null
        });
      }
    }
  }

  return sortAttendanceRows(Array.from(rowsByKey.values()));
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
