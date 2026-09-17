"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { requireCurrentOwner } from "@/lib/current-business";
import {
  validatePromotion,
  type PromotionFieldErrors,
} from "@/lib/promotions";
import { localToUTC } from "@/lib/datetime";

export type PromotionState = {
  error?: string;
  fieldErrors?: PromotionFieldErrors;
};

// Fecha "YYYY-MM-DD" (input type="date"). Vacía o inválida -> null (sin límite).
function parseDay(dateStr: string, timezone: string, endOfDay: boolean): Date | null {
  const trimmed = dateStr?.trim() ?? "";
  if (!trimmed) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  // El día de fin se interpreta hasta el final del día (inclusivo).
  return localToUTC(trimmed, endOfDay ? "23:59" : "00:00", timezone);
}

export async function createPromotion(
  _prevState: PromotionState,
  formData: FormData
): Promise<PromotionState> {
  await requireAuth();
  const business = await requireCurrentOwner();

  const discountValueStr = formData.get("discountValue")?.toString() ?? "";
  const result = validatePromotion({
    name: formData.get("name")?.toString() ?? "",
    description: formData.get("description")?.toString() ?? "",
    discountType: formData.get("discountType")?.toString() ?? "",
    discountValue: discountValueStr ? parseInt(discountValueStr, 10) : null,
    startsAt: parseDay(formData.get("startsAt")?.toString() ?? "", business.timezone, false),
    endsAt: parseDay(formData.get("endsAt")?.toString() ?? "", business.timezone, true),
  });

  if (!result.ok) {
    return { fieldErrors: result.fieldErrors };
  }

  try {
    await db.promotion.create({
      data: {
        businessId: business.id,
        ...result.value,
      },
    });
  } catch (error) {
    console.error("Error al crear promoción", error);
    return { error: "No se pudo crear la promoción. Intentalo de nuevo." };
  }

  revalidatePath("/dashboard/promotions");
  revalidatePath(`/${business.slug}`);
  return {};
}

export async function updatePromotion(
  promotionId: string,
  _prevState: PromotionState,
  formData: FormData
): Promise<PromotionState> {
  await requireAuth();
  const business = await requireCurrentOwner();

  const discountValueStr = formData.get("discountValue")?.toString() ?? "";
  const result = validatePromotion({
    name: formData.get("name")?.toString() ?? "",
    description: formData.get("description")?.toString() ?? "",
    discountType: formData.get("discountType")?.toString() ?? "",
    discountValue: discountValueStr ? parseInt(discountValueStr, 10) : null,
    startsAt: parseDay(formData.get("startsAt")?.toString() ?? "", business.timezone, false),
    endsAt: parseDay(formData.get("endsAt")?.toString() ?? "", business.timezone, true),
  });

  if (!result.ok) {
    return { fieldErrors: result.fieldErrors };
  }

  try {
    const updated = await db.promotion.updateMany({
      where: { id: promotionId, businessId: business.id },
      data: result.value,
    });

    if (updated.count === 0) {
      return { error: "Promoción no encontrada." };
    }
  } catch (error) {
    console.error("Error al actualizar promoción", error);
    return { error: "No se pudo actualizar la promoción." };
  }

  revalidatePath("/dashboard/promotions");
  revalidatePath(`/${business.slug}`);
  return {};
}

export async function deletePromotion(
  promotionId: string
): Promise<{ error?: string }> {
  await requireAuth();
  const business = await requireCurrentOwner();

  try {
    const deleted = await db.promotion.deleteMany({
      where: { id: promotionId, businessId: business.id },
    });

    if (deleted.count === 0) {
      return { error: "Promoción no encontrada." };
    }
  } catch (error) {
    console.error("Error al eliminar promoción", error);
    return { error: "No se pudo eliminar la promoción." };
  }

  revalidatePath("/dashboard/promotions");
  revalidatePath(`/${business.slug}`);
  return {};
}