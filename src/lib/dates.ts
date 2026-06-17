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

export function getWeekStartDate(date = new Date()) {
  const weekday = getBusinessWeekday(date);
  const [year, month, day] = getBusinessDate(date).split("-").map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  utcDate.setUTCDate(utcDate.getUTCDate() - (weekday - 1));
  const weekYear = utcDate.getUTCFullYear();
  const weekMonth = String(utcDate.getUTCMonth() + 1).padStart(2, "0");
  const weekDay = String(utcDate.getUTCDate()).padStart(2, "0");
  return `${weekYear}-${weekMonth}-${weekDay}`;
}

export function getWeekEndDate(date = new Date()) {
  const [year, month, day] = getWeekStartDate(date).split("-").map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  utcDate.setUTCDate(utcDate.getUTCDate() + 6);
  const weekYear = utcDate.getUTCFullYear();
  const weekMonth = String(utcDate.getUTCMonth() + 1).padStart(2, "0");
  const weekDay = String(utcDate.getUTCDate()).padStart(2, "0");
  return `${weekYear}-${weekMonth}-${weekDay}`;
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

export function minutesAfterEntry(now: Date, entryTime: string) {
  const current = getBusinessTime(now).slice(0, 5);
  return minutesFromTime(current) - minutesFromTime(entryTime);
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
