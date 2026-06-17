import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getWorkerByDni, isValidDni, normalizeDni } from "@/lib/worker-auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const dni = normalizeDni(url.searchParams.get("dni") ?? "");

  if (!isValidDni(dni)) {
    return jsonError("Ingresa un DNI valido de 8 digitos.", 400);
  }

  const worker = await getWorkerByDni(dni);
  if (!worker) {
    return jsonError("DNI no registrado.", 404);
  }

  if (worker.status === "inactive") {
    return jsonError("Trabajador inactivo.", 403);
  }

  return NextResponse.json({
    id: worker.id,
    fullName: worker.fullName,
    dni: worker.dni,
    status: worker.status
  });
}
