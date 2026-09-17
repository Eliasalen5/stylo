"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { requireCurrentOwner } from "@/lib/current-business";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { normalizeSlug, isSlugAvailable, isValidTimeZone } from "@/lib/business";
import { normalizeTimeZone } from "@/lib/timezones";
import { geocodeAddress, isValidCoordinates } from "@/lib/geocoding";

export type CreateBusinessState = {
  error?: string;
  fieldErrors?: {
    name?: string;
    slug?: string;
    timezone?: string;
  };
};

/**
 * Crea un negocio (tenant) y registra al usuario autenticado como OWNER.
 *
 * Seguridad:
 *  - El usuario proviene de la sesión del servidor (requireAuth).
 *  - No se acepta userId/businessId/role desde el cliente.
 *  - Todo se valida en servidor y se crea en una transacción.
 */
export async function createBusiness(
  _prevState: CreateBusinessState,
  formData: FormData
): Promise<CreateBusinessState> {
  const user = await requireAuth();

  const name = formData.get("name")?.toString().trim() ?? "";
  const slugInput = formData.get("slug")?.toString() ?? "";
  const timezone = formData.get("timezone")?.toString().trim() ?? "";
  const phone = formData.get("phone")?.toString().trim() || null;
  const description = formData.get("description")?.toString().trim() || null;

  const fieldErrors: NonNullable<CreateBusinessState["fieldErrors"]> = {};

  if (!name) {
    fieldErrors.name = "El nombre es obligatorio.";
  } else if (name.length > 120) {
    fieldErrors.name = "El nombre no puede superar los 120 caracteres.";
  }

  const slug = normalizeSlug(slugInput);
  if (!slug) {
    fieldErrors.slug =
      "El slug solo puede contener letras, números y guiones (ej: mi-barberia).";
  } else if (await isSlugAvailable(slug) === false) {
    fieldErrors.slug = "Ese slug ya está en uso. Elegí otro.";
  }

  if (!isValidTimeZone(timezone)) {
    fieldErrors.timezone = "La zona horaria no es válida.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  const storedTimezone = normalizeTimeZone(timezone);

  try {
    // Nested create: crea Business + BusinessMember (OWNER) en una sola
    // operación atómica. El usuario proviene de la sesión autenticada.
    await db.user.update({
      where: { id: user.id },
      data: {
        memberships: {
          create: {
            role: "OWNER",
            business: {
              create: {
                name,
                slug: slug!,
                description,
                phone,
                timezone: storedTimezone,
              },
            },
          },
        },
      },
    });
  } catch (error) {
    // El slug tiene un índice único: si otro request lo creó primero,
    // la transacción falla y mostramos un error claro.
    console.error("Error al crear negocio", error);
    return { error: "No se pudo crear el negocio. Intentalo de nuevo." };
  }

  revalidatePath("/dashboard");
  redirect(`/dashboard?business=${slug}`);
}

/**
 * Marca un negocio como destacado / no destacado en el directorio público.
 * Es una decisión de la plataforma (requirePlatformAdmin), nunca del OWNER.
 */
export async function toggleBusinessFeatured(
  businessId: string,
  isFeatured: boolean
): Promise<void> {
  await requirePlatformAdmin();

  await db.business.update({
    where: { id: businessId },
    data: { isFeatured },
  });

  revalidatePath("/");
  revalidatePath("/admin/businesses");
}

export type UpdateBusinessState = {
  error?: string;
  success?: boolean;
  fieldErrors?: {
    name?: string;
    description?: string;
    phone?: string;
    email?: string;
    address?: string;
    timezone?: string;
    latitude?: string;
    longitude?: string;
  };
};

/**
 * Actualiza el perfil del negocio actual (tenant). Solo OWNER (requiere
 * pertenencia deducida en servidor; el businessId nunca viene del cliente).
 *
 * Coordenadas (en este orden de prioridad):
 *  1. Override manual: si el usuario manda lat/lng, se usan (validadas).
 *  2. Geocodificación: si hay dirección y no hay override, se intenta
 *     geocodificar con Google Maps. Si falla (o falta la API key), se
 *     conservan las coordenadas previas.
 */
export async function updateBusiness(
  _prevState: UpdateBusinessState,
  formData: FormData
): Promise<UpdateBusinessState> {
  await requireAuth();
  const business = await requireCurrentOwner();

  const name = formData.get("name")?.toString().trim() ?? "";
  const description = formData.get("description")?.toString().trim() || null;
  const phone = formData.get("phone")?.toString().trim() || null;
  const email = formData.get("email")?.toString().trim() || null;
  const address = formData.get("address")?.toString().trim() || null;
  const timezone = formData.get("timezone")?.toString().trim() ?? "";
  const latStr = formData.get("latitude")?.toString().trim() ?? "";
  const lngStr = formData.get("longitude")?.toString().trim() ?? "";

  const fieldErrors: NonNullable<UpdateBusinessState["fieldErrors"]> = {};

  if (!name) {
    fieldErrors.name = "El nombre es obligatorio.";
  } else if (name.length > 120) {
    fieldErrors.name = "El nombre no puede superar los 120 caracteres.";
  }

  if (description && description.length > 500) {
    fieldErrors.description = "La descripción no puede superar los 500 caracteres.";
  }

  if (phone && phone.length > 30) {
    fieldErrors.phone = "El teléfono no puede superar los 30 caracteres.";
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fieldErrors.email = "El email no es válido.";
  }

  if (address && address.length > 200) {
    fieldErrors.address = "La dirección no puede superar los 200 caracteres.";
  }

  if (!isValidTimeZone(timezone)) {
    fieldErrors.timezone = "La zona horaria no es válida.";
  }

  const overrideLat = latStr ? parseFloat(latStr) : null;
  const overrideLng = lngStr ? parseFloat(lngStr) : null;
  const hasOverride = overrideLat !== null || overrideLng !== null;

  if (hasOverride && (overrideLat === null || overrideLng === null)) {
    fieldErrors.latitude = "Si completás coordenadas, cargá latitud y longitud.";
  } else if (
    hasOverride &&
    !isValidCoordinates(overrideLat as number, overrideLng as number)
  ) {
    fieldErrors.latitude = "Coordenadas inválidas (lat -90..90, lng -180..180).";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  // Resolución de coordenadas
  let latitude: number | null = null;
  let longitude: number | null = null;
  let updateCoordinates = false;

  if (hasOverride) {
    latitude = overrideLat;
    longitude = overrideLng;
    updateCoordinates = true;
  } else if (address) {
    const coords = await geocodeAddress(address);
    if (coords) {
      latitude = coords.latitude;
      longitude = coords.longitude;
      updateCoordinates = true;
    }
    // Sin coordenadas nuevas: se conservan las existentes (o null).
  }

  try {
    await db.business.update({
      where: { id: business.id },
      data: {
        name,
        description,
        phone,
        email,
        address,
        timezone: normalizeTimeZone(timezone),
        latitude: updateCoordinates ? latitude : undefined,
        longitude: updateCoordinates ? longitude : undefined,
      },
    });
  } catch (error) {
    console.error("Error al actualizar negocio", error);
    return { error: "No se pudo actualizar el negocio. Intentalo de nuevo." };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/${business.slug}`);
  revalidatePath("/");
  return { success: true };
}
