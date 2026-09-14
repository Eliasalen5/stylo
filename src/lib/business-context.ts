import { cookies } from "next/headers";
import { getMemberships } from "@/lib/multi-tenant";

const COOKIE_NAME = "stylo_business_id";

/**
 * Devuelve el businessId del negocio seleccionado.
 *
 * Prioridad:
 *  1. Search param `business` (slug)
 *  2. Cookie `stylo_business_id` (id)
 *  3. Primer negocio del usuario
 *
 * Devuelve null si el usuario no tiene negocios.
 */
export async function getSelectedBusinessId(
  searchParams?: Record<string, string | string[] | undefined>
): Promise<string | null> {
  const memberships = await getMemberships();
  if (memberships.length === 0) return null;

  // 1. Por search param (slug)
  const slugParam =
    typeof searchParams?.business === "string"
      ? searchParams.business
      : undefined;
  if (slugParam) {
    const match = memberships.find((m) => m.business.slug === slugParam);
    if (match) return match.business.id;
  }

  // 2. Por cookie (id)
  const cookieStore = await cookies();
  const cookieId = cookieStore.get(COOKIE_NAME)?.value;
  if (cookieId) {
    const match = memberships.find((m) => m.business.id === cookieId);
    if (match) return match.business.id;
  }

  // 3. Primer negocio
  return memberships[0].business.id;
}

export { COOKIE_NAME as BUSINESS_COOKIE_NAME };
