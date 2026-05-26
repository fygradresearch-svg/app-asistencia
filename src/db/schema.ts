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

export const attendanceStatusEnum = pgEnum("attendance_status", [
  "punctual",
  "late",
  "absent",
  "incomplete",
  "rejected_gps"
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
  activationCode: varchar("activation_code", { length: 4 }).notNull().unique(),
  codeUsed: boolean("code_used").default(false).notNull(),
  status: workerStatusEnum("status").default("pending").notNull(),
  deviceToken: varchar("device_token", { length: 160 }).unique(),
  scheduleEntryTime: time("schedule_entry_time"),
  scheduleExitTime: time("schedule_exit_time"),
  scheduleToleranceMinutes: integer("schedule_tolerance_minutes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  activatedAt: timestamp("activated_at", { withTimezone: true }),
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

export const attendanceRecords = pgTable(
  "attendance_records",
  {
    id: serial("id").primaryKey(),
    workerId: integer("worker_id")
      .notNull()
      .references(() => workers.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    checkInTime: timestamp("check_in_time", { withTimezone: true }),
    checkOutTime: timestamp("check_out_time", { withTimezone: true }),
    checkInLatitude: doublePrecision("check_in_latitude"),
    checkInLongitude: doublePrecision("check_in_longitude"),
    checkOutLatitude: doublePrecision("check_out_latitude"),
    checkOutLongitude: doublePrecision("check_out_longitude"),
    checkInDistanceMeters: doublePrecision("check_in_distance_meters"),
    checkOutDistanceMeters: doublePrecision("check_out_distance_meters"),
    gpsStatus: gpsStatusEnum("gps_status").default("valid").notNull(),
    attendanceStatus: attendanceStatusEnum("attendance_status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    workerDateUnique: uniqueIndex("attendance_worker_date_unique").on(
      table.workerId,
      table.date
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
export type AttendanceStatus = (typeof attendanceStatusEnum.enumValues)[number];
export type GpsStatus = (typeof gpsStatusEnum.enumValues)[number];
export type AttemptType = (typeof attemptTypeEnum.enumValues)[number];

export type Worker = typeof workers.$inferSelect;
export type WorkerDaySchedule = typeof workerDaySchedules.$inferSelect;
export type AttendanceRecord = typeof attendanceRecords.$inferSelect;
