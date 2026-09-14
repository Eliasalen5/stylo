"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { requireCurrentOwner } from "@/lib/current-business";

export type ProfessionalState = {
  error?: string;
  fieldErrors?: {
    name?: string;
    email?: string;
    phone?: string;
  };
};

export async function createProfessional(
  _prevState: ProfessionalState,
  formData: FormData
): Promise<ProfessionalState> {
  await requireAuth();
  const business = await requireCurrentOwner();

  const name = formData.get("name")?.toString().trim() ?? "";
  const email = formData.get("email")?.toString().trim() || null;
  const phone = formData.get("phone")?.toString().trim() || null;

  const fieldErrors: NonNullable<ProfessionalState["fieldErrors"]> = {};

  if (!name) {
    fieldErrors.name = "El nombre es obligatorio.";
  } else if (name.length > 120) {
    fieldErrors.name = "El nombre no puede superar los 120 caracteres.";
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fieldErrors.email = "El email no es válido.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  try {
    await db.professional.create({
      data: {
        businessId: business.id,
        name,
        email,
        phone,
      },
    });
  } catch (error) {
    console.error("Error al crear profesional", error);
    return { error: "No se pudo crear el profesional. Intentalo de nuevo." };
  }

  revalidatePath("/dashboard/professionals");
  return {};
}

export type UpdateProfessionalState = ProfessionalState & { success?: boolean };

export async function updateProfessional(
  professionalId: string,
  _prevState: UpdateProfessionalState,
  formData: FormData
): Promise<UpdateProfessionalState> {
  await requireAuth();
  const business = await requireCurrentOwner();

  const name = formData.get("name")?.toString().trim() ?? "";
  const email = formData.get("email")?.toString().trim() || null;
  const phone = formData.get("phone")?.toString().trim() || null;

  const fieldErrors: NonNullable<ProfessionalState["fieldErrors"]> = {};

  if (!name) {
    fieldErrors.name = "El nombre es obligatorio.";
  } else if (name.length > 120) {
    fieldErrors.name = "El nombre no puede superar los 120 caracteres.";
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fieldErrors.email = "El email no es válido.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  try {
    const updated = await db.professional.updateMany({
      where: { id: professionalId, businessId: business.id },
      data: { name, email, phone },
    });

    if (updated.count === 0) {
      return { error: "Profesional no encontrado." };
    }
  } catch (error) {
    console.error("Error al actualizar profesional", error);
    return { error: "No se pudo actualizar el profesional." };
  }

  revalidatePath("/dashboard/professionals");
  return {};
}

export async function deleteProfessional(
  professionalId: string
): Promise<{ error?: string }> {
  await requireAuth();
  const business = await requireCurrentOwner();

  try {
    const deleted = await db.professional.deleteMany({
      where: { id: professionalId, businessId: business.id },
    });

    if (deleted.count === 0) {
      return { error: "Profesional no encontrado." };
    }
  } catch (error) {
    console.error("Error al eliminar profesional", error);
    return { error: "No se pudo eliminar el profesional." };
  }

  revalidatePath("/dashboard/professionals");
  return {};
}

export async function toggleProfessionalServices(
  professionalId: string,
  serviceIds: string[]
): Promise<{ error?: string }> {
  await requireAuth();
  const business = await requireCurrentOwner();

  try {
    const professional = await db.professional.findFirst({
      where: { id: professionalId, businessId: business.id },
    });

    if (!professional) {
      return { error: "Profesional no encontrado." };
    }

    const validServices = await db.service.findMany({
      where: { id: { in: serviceIds }, businessId: business.id },
      select: { id: true },
    });

    await db.professional.update({
      where: { id: professionalId },
      data: {
        services: {
          set: validServices.map((s) => ({ id: s.id })),
        },
      },
    });
  } catch (error) {
    console.error("Error al asignar servicios", error);
    return { error: "No se pudieron asignar los servicios." };
  }

  revalidatePath("/dashboard/professionals");
  return {};
}
