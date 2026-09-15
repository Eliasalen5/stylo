import { requireAuth } from "@/lib/auth";

/**
 * Autorización para el panel de plataforma (admin global).
 * A diferencia del dashboard de negocio, no participa del multi-tenancy:
 * es un área de la plataforma en sí misma.
 */
export async function requirePlatformAdmin() {
  const user = await requireAuth();

  if (!user.isPlatformAdmin) {
    throw new Error("No autorizado: se requiere acceso de plataforma.");
  }

  return user;
}