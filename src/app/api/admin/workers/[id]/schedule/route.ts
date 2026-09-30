import { requireAdminSession } from "@/lib/auth";
import { jsonError } from "@/lib/http";

/**
 * Los reportes usan exclusivamente los horarios semanales. Se conserva esta
 * ruta para responder de forma explícita a clientes antiguos, sin permitir
 * que vuelvan a modificar el horario individual.
 */
export async function PATCH() {
  if (!(await requireAdminSession())) {
    return jsonError("No autorizado.", 401);
  }

  return jsonError(
    "La edición de horarios individuales está deshabilitada. Gestiona los horarios semanales del trabajador.",
    410
  );
}
