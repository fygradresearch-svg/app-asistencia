export const APP_TIME_ZONE = "America/Lima";

function getParts(date: Date, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    ...options
  }).formatToParts(date);
}

function partValue(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  return parts.find((part) => part.type === type)?.value ?? "";
}

export function getBusinessDate(date = new Date()) {
  const parts = getParts(date, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return `${partValue(parts, "year")}-${partValue(parts, "month")}-${partValue(parts, "day")}`;
}

export function getBusinessWeekday(date = new Date()) {
  const [year, month, day] = getBusinessDate(date).split("-").map(Number);
  const utcDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return utcDay === 0 ? 7 : utcDay;
}

export function getBusinessTime(date = new Date()) {
  const parts = getParts(date, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  const hour = partValue(parts, "hour") === "24" ? "00" : partValue(parts, "hour");
  return `${hour}:${partValue(parts, "minute")}:${partValue(parts, "second")}`;
}

export function minutesFromTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function isLateForSchedule(now: Date, entryTime: string, toleranceMinutes: number) {
  const current = getBusinessTime(now).slice(0, 5);
  return minutesFromTime(current) > minutesFromTime(entryTime) + toleranceMinutes;
}

export function formatDateTime(value: Date | string | null) {
  if (!value) {
    return "";
  }
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: APP_TIME_ZONE,
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

export function formatTimeOnly(value: Date | string | null) {
  if (!value) {
    return "";
  }
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}
