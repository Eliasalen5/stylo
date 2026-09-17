import { db } from "@/lib/db";

export type DirectoryBusiness = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  logoUrl: string | null;
  timezone: string;
  isFeatured: boolean;
  latitude: number | null;
  longitude: number | null;
  servicesCount: number;
  professionalsCount: number;
};

/**
 * Lista los negocios del directorio público: activos y con al menos un
 * servicio activo. Los destacados aparecen primero (orden estable por nombre).
 *
 * Es la lógica compartida entre la home (web) y la API pública `/api/v1`.
 * @param query Filtro opcional por nombre o descripción.
 */
export async function listDirectoryBusinesses(
  query?: string
): Promise<DirectoryBusiness[]> {
  const trimmed = query?.trim().slice(0, 100) ?? "";

  const businesses = await db.business.findMany({
    where: {
      isActive: true,
      services: { some: { isActive: true } },
      ...(trimmed
        ? {
            OR: [
              { name: { contains: trimmed, mode: "insensitive" } },
              { description: { contains: trimmed, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      address: true,
      phone: true,
      logoUrl: true,
      timezone: true,
      isFeatured: true,
      latitude: true,
      longitude: true,
      _count: {
        select: {
          services: { where: { isActive: true } },
          professionals: { where: { isActive: true } },
        },
      },
    },
    orderBy: [{ isFeatured: "desc" }, { name: "asc" }],
  });

  return businesses.map((b) => ({
    id: b.id,
    name: b.name,
    slug: b.slug,
    description: b.description,
    address: b.address,
    phone: b.phone,
    logoUrl: b.logoUrl,
    timezone: b.timezone,
    isFeatured: b.isFeatured,
    latitude: b.latitude,
    longitude: b.longitude,
    servicesCount: b._count.services,
    professionalsCount: b._count.professionals,
  }));
}