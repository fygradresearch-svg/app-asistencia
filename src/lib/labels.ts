export const workerStatusLabels: Record<string, string> = {
  pending: "Pendiente",
  active: "Activo",
  inactive: "Inactivo"
};

export const workerTypeLabels: Record<string, string> = {
  worker: "Trabajador",
  intern: "Practicante"
};

export const shiftTypeLabels: Record<string, string> = {
  morning: "Mañana",
  afternoon: "Tarde"
};

export const attendanceStatusLabels: Record<string, string> = {
  punctual: "Puntual",
  tolerance: "Tolerancia",
  late: "Tardanza",
  absent: "Falta"
};

export const checkoutSourceLabels: Record<string, string> = {
  worker: "Trabajador",
  admin: "Administración",
  automatic: "Automática"
};

export const scheduleSourceLabels: Record<string, string> = {
  override: "Horario especial",
  weekly: "Horario semanal",
  worker: "Horario individual",
  company: "Horario general",
  legacy: "Horario anterior"
};

export const gpsStatusLabels: Record<string, string> = {
  valid: "Valido",
  outside_zone: "Fuera de zona"
};
