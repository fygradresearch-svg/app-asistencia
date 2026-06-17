import {
  boolean,
  date,
  doublePrecision,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  time,
  timestamp,
  uniqueIndex,
  varchar
} from "drizzle-orm/pg-core";

export const workerStatusEnum = pgEnum("worker_status", [
  "pending",
  "active",
  "inactive"
]);

export const shiftTypeEnum = pgEnum("shift_type", ["morning", "afternoon"]);

export const shiftAttendanceStatusEnum = pgEnum("shift_attendance_status", [
  "punctual",
  "tolerance",
  "late",
  "absent"
]);

export const gpsStatusEnum = pgEnum("gps_status", ["valid", "outside_zone"]);

export const attemptTypeEnum = pgEnum("attempt_type", ["check_in", "check_out"]);

export const admins = pgTable("admins", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 80 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const workers = pgTable("workers", {
  id: serial("id").primaryKey(),
  fullName: varchar("full_name", { length: 180 }).notNull(),
  dni: varchar("dni", { length: 8 }).notNull().unique(),
  status: workerStatusEnum("status").default("active").notNull(),
  scheduleEntryTime: time("schedule_entry_time"),
  scheduleExitTime: time("schedule_exit_time"),
  scheduleToleranceMinutes: integer("schedule_tolerance_minutes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const workerDaySchedules = pgTable(
  "worker_day_schedules",
  {
    id: serial("id").primaryKey(),
    workerId: integer("worker_id")
      .notNull()
      .references(() => workers.id, { onDelete: "cascade" }),
    weekday: integer("weekday").notNull(),
    entryTime: time("entry_time").notNull(),
    exitTime: time("exit_time").notNull(),
    morningEntryTime: time("morning_entry_time"),
    morningExitTime: time("morning_exit_time"),
    afternoonEntryTime: time("afternoon_entry_time"),
    afternoonExitTime: time("afternoon_exit_time"),
    toleranceMinutes: integer("tolerance_minutes").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    workerWeekdayUnique: uniqueIndex("worker_day_schedule_unique").on(
      table.workerId,
      table.weekday
    )
  })
);

export const locations = pgTable("locations", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 140 }).notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  allowedRadiusMeters: integer("allowed_radius_meters").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const workSchedules = pgTable("work_schedules", {
  id: serial("id").primaryKey(),
  entryTime: time("entry_time").notNull(),
  exitTime: time("exit_time").notNull(),
  toleranceMinutes: integer("tolerance_minutes").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const shiftAttendanceRecords = pgTable(
  "shift_attendance_records",
  {
    id: serial("id").primaryKey(),
    workerId: integer("worker_id")
      .notNull()
      .references(() => workers.id, { onDelete: "cascade" }),
    dni: varchar("dni", { length: 8 }).notNull(),
    date: date("date", { mode: "string" }).notNull(),
    serverTime: timestamp("server_time", { withTimezone: true }).notNull(),
    shiftType: shiftTypeEnum("shift_type").notNull(),
    distanceMeters: doublePrecision("distance_meters").notNull(),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    status: shiftAttendanceStatusEnum("status").notNull(),
    lateMinutes: integer("late_minutes").default(0).notNull(),
    fineAmountCents: integer("fine_amount_cents").default(0).notNull(),
    toleranceUsed: boolean("tolerance_used").default(false).notNull(),
    checkOutTime: timestamp("check_out_time", { withTimezone: true }),
    checkOutLatitude: doublePrecision("check_out_latitude"),
    checkOutLongitude: doublePrecision("check_out_longitude"),
    checkOutDistanceMeters: doublePrecision("check_out_distance_meters"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    workerDateShiftUnique: uniqueIndex("shift_attendance_worker_date_shift_unique").on(
      table.workerId,
      table.date,
      table.shiftType
    )
  })
);

export const attendanceAttempts = pgTable("attendance_attempts", {
  id: serial("id").primaryKey(),
  workerId: integer("worker_id")
    .notNull()
    .references(() => workers.id, { onDelete: "cascade" }),
  type: attemptTypeEnum("type").notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  distanceMeters: doublePrecision("distance_meters").notNull(),
  gpsStatus: gpsStatusEnum("gps_status").notNull(),
  accepted: boolean("accepted").default(false).notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export type WorkerStatus = (typeof workerStatusEnum.enumValues)[number];
export type ShiftType = (typeof shiftTypeEnum.enumValues)[number];
export type ShiftAttendanceStatus = (typeof shiftAttendanceStatusEnum.enumValues)[number];
export type GpsStatus = (typeof gpsStatusEnum.enumValues)[number];
export type AttemptType = (typeof attemptTypeEnum.enumValues)[number];

export type Worker = typeof workers.$inferSelect;
export type WorkerDaySchedule = typeof workerDaySchedules.$inferSelect;
export type ShiftAttendanceRecord = typeof shiftAttendanceRecords.$inferSelect;
