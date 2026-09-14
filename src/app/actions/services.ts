"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { requireCurrentOwner } from "@/lib/current-business";

export type ServiceState = {
  error?: string;
  fieldErrors?: {
    name?: string;
    durationMinutes?: string;
    price?: string;
    description?: string;
  };
};

export async function createService(
  _prevState: ServiceState,
  formData: FormData
): Promise<ServiceState> {
  await requireAuth();
  const business = await requireCurrentOwner();

  const name = formData.get("name")?.toString().trim() ?? "";
  const description = formData.get("description")?.toString().trim() || null;
  const durationStr = formData.get("durationMinutes")?.toString() ?? "";
  const priceStr = formData.get("price")?.toString() ?? "";

  const fieldErrors: NonNullable<ServiceState["fieldErrors"]> = {};

  if (!name) {
    fieldErrors.name = "El nombre es obligatorio.";
  } else if (name.length > 120) {
    fieldErrors.name = "El nombre no puede superar los 120 caracteres.";
  }

  const durationMinutes = parseInt(durationStr, 10);
  if (!durationStr || isNaN(durationMinutes)) {
    fieldErrors.durationMinutes = "La duración es obligatoria.";
  } else if (durationMinutes < 5 || durationMinutes > 480) {
    fieldErrors.durationMinutes = "La duración debe ser entre 5 y 480 minutos.";
  }

  const price = parseInt(priceStr, 10);
  if (!priceStr || isNaN(price)) {
    fieldErrors.price = "El precio es obligatorio.";
  } else if (price < 0) {
    fieldErrors.price = "El precio no puede ser negativo.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  try {
    await db.service.create({
      data: {
        businessId: business.id,
        name,
        description,
        durationMinutes,
        price,
      },
    });
  } catch (error) {
    console.error("Error al crear servicio", error);
    return { error: "No se pudo crear el servicio. Intentalo de nuevo." };
  }

  revalidatePath("/dashboard/services");
  return {};
}

export type UpdateServiceState = ServiceState & { success?: boolean };

export async function updateService(
  serviceId: string,
  _prevState: UpdateServiceState,
  formData: FormData
): Promise<UpdateServiceState> {
  await requireAuth();
  const business = await requireCurrentOwner();

  const name = formData.get("name")?.toString().trim() ?? "";
  const description = formData.get("description")?.toString().trim() || null;
  const durationStr = formData.get("durationMinutes")?.toString() ?? "";
  const priceStr = formData.get("price")?.toString() ?? "";

  const fieldErrors: NonNullable<ServiceState["fieldErrors"]> = {};

  if (!name) {
    fieldErrors.name = "El nombre es obligatorio.";
  } else if (name.length > 120) {
    fieldErrors.name = "El nombre no puede superar los 120 caracteres.";
  }

  const durationMinutes = parseInt(durationStr, 10);
  if (!durationStr || isNaN(durationMinutes)) {
    fieldErrors.durationMinutes = "La duración es obligatoria.";
  } else if (durationMinutes < 5 || durationMinutes > 480) {
    fieldErrors.durationMinutes = "La duración debe ser entre 5 y 480 minutos.";
  }

  const price = parseInt(priceStr, 10);
  if (!priceStr || isNaN(price)) {
    fieldErrors.price = "El precio es obligatorio.";
  } else if (price < 0) {
    fieldErrors.price = "El precio no puede ser negativo.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  try {
    const updated = await db.service.updateMany({
      where: { id: serviceId, businessId: business.id },
      data: { name, description, durationMinutes, price },
    });

    if (updated.count === 0) {
      return { error: "Servicio no encontrado." };
    }
  } catch (error) {
    console.error("Error al actualizar servicio", error);
    return { error: "No se pudo actualizar el servicio." };
  }

  revalidatePath("/dashboard/services");
  return {};
}

export async function deleteService(serviceId: string): Promise<{ error?: string }> {
  await requireAuth();
  const business = await requireCurrentOwner();

  try {
    const deleted = await db.service.deleteMany({
      where: { id: serviceId, businessId: business.id },
    });

    if (deleted.count === 0) {
      return { error: "Servicio no encontrado." };
    }
  } catch (error) {
    console.error("Error al eliminar servicio", error);
    return { error: "No se pudo eliminar el servicio." };
  }

  revalidatePath("/dashboard/services");
  return {};
}
