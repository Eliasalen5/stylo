"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { requireCurrentOwner } from "@/lib/current-business";
import type { WeekDay } from "@/generated/prisma/client";

export type HoursState = {
  error?: string;
  fieldErrors?: {
    dayOfWeek?: string;
    morningStartTime?: string;
    morningEndTime?: string;
    afternoonStartTime?: string;
    afternoonEndTime?: string;
  };
};

const TIME_RE = /^\d{2}:\d{2}$/;
const validDays: WeekDay[] = [
  "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY",
];

function validateTimeRange(
  start: string,
  end: string,
  label: string,
  fieldErrors: NonNullable<HoursState["fieldErrors"]>
): boolean {
  let valid = true;

  if (!start || !TIME_RE.test(start)) {
    fieldErrors[`${label}StartTime` as keyof NonNullable<HoursState["fieldErrors"]>] =
      "Formato inválido (HH:MM).";
    valid = false;
  }

  if (!end || !TIME_RE.test(end)) {
    fieldErrors[`${label}EndTime` as keyof NonNullable<HoursState["fieldErrors"]>] =
      "Formato inválido (HH:MM).";
    valid = false;
  }

  if (start && end && start >= end) {
    fieldErrors[`${label}EndTime` as keyof NonNullable<HoursState["fieldErrors"]>] =
      "La hora de fin debe ser posterior a la de inicio.";
    valid = false;
  }

  return valid;
}

export async function upsertBusinessHours(
  _prevState: HoursState,
  formData: FormData
): Promise<HoursState> {
  await requireAuth();
  const business = await requireCurrentOwner();

  const dayOfWeek = formData.get("dayOfWeek")?.toString() as WeekDay | undefined;
  const professionalId = formData.get("professionalId")?.toString().trim() || null;

  const morningStart = formData.get("morningStartTime")?.toString().trim() ?? "";
  const morningEnd = formData.get("morningEndTime")?.toString().trim() ?? "";
  const morningActive = formData.get("morningIsActive") === "on";

  const afternoonStart = formData.get("afternoonStartTime")?.toString().trim() ?? "";
  const afternoonEnd = formData.get("afternoonEndTime")?.toString().trim() ?? "";
  const afternoonActive = formData.get("afternoonIsActive") === "on";

  const fieldErrors: NonNullable<HoursState["fieldErrors"]> = {};

  if (!dayOfWeek || !validDays.includes(dayOfWeek)) {
    fieldErrors.dayOfWeek = "Seleccioná un día válido.";
  }

  const hasMorning = morningStart || morningEnd;
  const hasAfternoon = afternoonStart || afternoonEnd;

  if (hasMorning) {
    validateTimeRange(morningStart, morningEnd, "morning", fieldErrors);
  }

  if (hasAfternoon) {
    validateTimeRange(afternoonStart, afternoonEnd, "afternoon", fieldErrors);
  }

  if (!hasMorning && !hasAfternoon) {
    fieldErrors.morningStartTime = "Completá al menos un turno (mañana o tarde).";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  try {
    const existingEntries = await db.businessHours.findMany({
      where: {
        businessId: business.id,
        dayOfWeek: dayOfWeek!,
        professionalId: professionalId || null,
      },
    });

    const toCreate: {
      businessId: string;
      dayOfWeek: WeekDay;
      startTime: string;
      endTime: string;
      professionalId: string | null;
      isActive: boolean;
    }[] = [];

    const toUpdate: { id: string; startTime: string; endTime: string; isActive: boolean }[] = [];
    const toDelete: string[] = [];

    const existingMorning = existingEntries.find((e) => e.startTime < "12:00");
    const existingAfternoon = existingEntries.find((e) => e.startTime >= "12:00");

    if (hasMorning) {
      if (existingMorning) {
        toUpdate.push({
          id: existingMorning.id,
          startTime: morningStart,
          endTime: morningEnd,
          isActive: morningActive,
        });
      } else {
        toCreate.push({
          businessId: business.id,
          dayOfWeek: dayOfWeek!,
          startTime: morningStart,
          endTime: morningEnd,
          professionalId: professionalId || null,
          isActive: morningActive,
        });
      }
    } else if (existingMorning) {
      toDelete.push(existingMorning.id);
    }

    if (hasAfternoon) {
      if (existingAfternoon) {
        toUpdate.push({
          id: existingAfternoon.id,
          startTime: afternoonStart,
          endTime: afternoonEnd,
          isActive: afternoonActive,
        });
      } else {
        toCreate.push({
          businessId: business.id,
          dayOfWeek: dayOfWeek!,
          startTime: afternoonStart,
          endTime: afternoonEnd,
          professionalId: professionalId || null,
          isActive: afternoonActive,
        });
      }
    } else if (existingAfternoon) {
      toDelete.push(existingAfternoon.id);
    }

    for (const entry of toCreate) {
      await db.businessHours.create({ data: entry });
    }
    for (const entry of toUpdate) {
      await db.businessHours.update({
        where: { id: entry.id },
        data: { startTime: entry.startTime, endTime: entry.endTime, isActive: entry.isActive },
      });
    }
    if (toDelete.length > 0) {
      await db.businessHours.deleteMany({ where: { id: { in: toDelete } } });
    }
  } catch (error) {
    console.error("Error al guardar horarios", error);
    return { error: "No se pudieron guardar los horarios." };
  }

  revalidatePath("/dashboard/hours");
  return {};
}

export async function deleteBusinessHours(
  hoursId: string
): Promise<{ error?: string }> {
  await requireAuth();
  const business = await requireCurrentOwner();

  try {
    const deleted = await db.businessHours.deleteMany({
      where: { id: hoursId, businessId: business.id },
    });

    if (deleted.count === 0) {
      return { error: "Horario no encontrado." };
    }
  } catch (error) {
    console.error("Error al eliminar horario", error);
    return { error: "No se pudo eliminar el horario." };
  }

  revalidatePath("/dashboard/hours");
  return {};
}
