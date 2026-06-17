export const MAX_GPS_RADIUS_METERS = 30;

export const DEFAULT_LOCATION = {
  name: "Oficina principal - Alameda Manuel Traverso 391",
  latitude: -12.048947,
  longitude: -75.191307,
  allowedRadiusMeters: MAX_GPS_RADIUS_METERS
};

export const DEFAULT_SCHEDULE = {
  entryTime: "09:00",
  exitTime: "19:00",
  toleranceMinutes: 0
};

export const DEFAULT_SHIFT_SCHEDULE = {
  morningEntryTime: "08:00",
  morningExitTime: "13:00",
  afternoonEntryTime: "14:00",
  afternoonExitTime: "19:00",
  toleranceMinutes: 0
};

export const WEEKLY_TOLERANCE_MAX_MINUTES = 9;
