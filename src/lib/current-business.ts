import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getSelectedBusinessId } from "@/lib/business-context";

export type CurrentBusiness = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  phone: string | null;
  email: string | null;
  description: string | null;
};

type MembershipWithBusiness = Awaited<
  ReturnType<typeof resolveMembership>
>;

/**
 * Resuelve el negocio activo del usuario autenticado y valida que pertenezca
 * a él (multi-tenancy). Lanza notFound() si no hay acceso.
 * Devuelve la membresía (incluye el rol) y los datos del negocio.
 */
async function resolveMembership(
  searchParams?: Record<string, string | string[] | undefined>
) {
  const user = await getCurrentUser();
  if (!user) notFound();

  const params: Record<string, string | string[] | undefined> =
    typeof searchParams === "object" && searchParams !== null
      ? { ...searchParams }
      : {};

  const businessId = await getSelectedBusinessId(params);
  if (!businessId) notFound();

  const membership = await db.businessMember.findUnique({
    where: {
      businessId_userId: {
        businessId,
        userId: user.id,
      },
    },
    include: {
      business: {
        select: {
          id: true,
          name: true,
          slug: true,
          timezone: true,
          phone: true,
          email: true,
          description: true,
        },
      },
    },
  });

  if (!membership) notFound();

  return membership;
}

/**
 * Requiere pertenencia al negocio (cualquier rol). Devuelve el negocio activo.
 * Se usa en páginas de consulta y operaciones de turnos.
 */
export async function requireCurrentBusiness(
  searchParams?: Record<string, string | string[] | undefined>
): Promise<CurrentBusiness> {
  const membership = await resolveMembership(searchParams);
  return membership.business;
}

/**
 * Requiere rol OWNER dentro del negocio. Devuelve el negocio activo.
 * Se usa en acciones de gestión (servicios, profesionales, horarios, etc.).
 */
export async function requireCurrentOwner(
  searchParams?: Record<string, string | string[] | undefined>
): Promise<CurrentBusiness> {
  const membership = await resolveMembership(searchParams);
  if (membership.role !== "OWNER") notFound();
  return membership.business;
}

export type { MembershipWithBusiness };