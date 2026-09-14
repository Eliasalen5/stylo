"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { requireCurrentBusiness } from "@/lib/current-business";
import { createBooking, runBookingTransaction, BookingConflict } from "@/lib/booking";
import { isBookableSlot } from "@/lib/availability";
import { parseStartsAt } from "@/lib/datetime";
import { notifyAppointmentEvent } from "@/lib/appointment-emails";
import { deletePendingRemindersForAppointment } from "@/lib/reminders";

export type AppointmentState = {
  error?: string;
  fieldErrors?: {
    serviceId?: string;
    professionalId?: string;
    date?: string;
    time?: string;
    customerId?: string;
  };
};

function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: unknown }).code === "P2002"
  );
}

export async function createAppointment(
  _prevState: AppointmentState,
  formData: FormData
): Promise<AppointmentState> {
  await requireAuth();
  const business = await requireCurrentBusiness();

  const serviceId = formData.get("serviceId")?.toString().trim() ?? "";
  const professionalId = formData.get("professionalId")?.toString().trim() ?? "";
  const customerId = formData.get("customerId")?.toString().trim() ?? "";
  const startsAtStr = formData.get("startsAt")?.toString().trim() ?? "";

  const fieldErrors: NonNullable<AppointmentState["fieldErrors"]> = {};

  if (!serviceId) fieldErrors.serviceId = "Seleccioná un servicio.";
  if (!professionalId) fieldErrors.professionalId = "Seleccioná un profesional.";
  if (!customerId) fieldErrors.customerId = "Seleccioná un cliente.";
  if (!startsAtStr) fieldErrors.time = "Seleccioná un horario.";

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  const startsAt = parseStartsAt(startsAtStr);
  if (!startsAt) {
    return { error: "Fecha y hora inválidas." };
  }

  const result = await createBooking({
    businessId: business.id,
    businessTimezone: business.timezone,
    professionalId,
    serviceId,
    customerId,
    startsAt,
  });

  if ("error" in result) {
    return { error: result.error };
  }

  revalidatePath("/dashboard/appointments");
  return {};
}

export async function updateAppointmentStatus(
  appointmentId: string,
  status: "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW"
): Promise<{ error?: string }> {
  await requireAuth();
  const business = await requireCurrentBusiness();

  const appointment = await db.appointment.findFirst({
    where: { id: appointmentId, businessId: business.id },
    select: { id: true, status: true },
  });

  if (!appointment) return { error: "Turno no encontrado." };

  // Reglas de transición de estado
  const allowedTransitions: Record<string, string[]> = {
    PENDING: ["CONFIRMED", "CANCELLED", "NO_SHOW"],
    CONFIRMED: ["COMPLETED", "CANCELLED", "NO_SHOW"],
    COMPLETED: [],
    CANCELLED: [],
    NO_SHOW: [],
  };

  if (!allowedTransitions[appointment.status]?.includes(status)) {
    return { error: "No se puede cambiar el estado en este momento." };
  }

  await db.appointment.update({
    where: { id: appointmentId },
    data: { status },
  });

  if (status === "CANCELLED") {
    await Promise.all([
      deletePendingRemindersForAppointment(appointmentId),
      notifyAppointmentEvent({
        businessId: business.id,
        appointmentId,
        kind: "CANCELLED",
      }),
    ]);
  } else if (status === "COMPLETED" || status === "NO_SHOW") {
    await deletePendingRemindersForAppointment(appointmentId);
  }

  revalidatePath("/dashboard/appointments");
  return {};
}

export type RescheduleState = {
  error?: string;
  fieldErrors?: {
    date?: string;
    time?: string;
  };
};

export async function rescheduleAppointment(
  appointmentId: string,
  _prevState: RescheduleState,
  formData: FormData
): Promise<RescheduleState> {
  await requireAuth();
  const business = await requireCurrentBusiness();

  const startsAtStr = formData.get("startsAt")?.toString().trim() ?? "";
  if (!startsAtStr) {
    return { fieldErrors: { time: "Seleccioná un nuevo horario." } };
  }

  const startsAt = parseStartsAt(startsAtStr);
  if (!startsAt) {
    return { error: "Fecha y hora inválidas." };
  }

  const appointment = await db.appointment.findFirst({
    where: { id: appointmentId, businessId: business.id },
    include: { service: { select: { durationMinutes: true } } },
  });

  if (!appointment) return { error: "Turno no encontrado." };

  if (appointment.status !== "PENDING" && appointment.status !== "CONFIRMED") {
    return { error: "Solo se pueden reprogramar turnos pendientes o confirmados." };
  }

  const endsAt = new Date(startsAt.getTime() + appointment.service.durationMinutes * 60 * 1000);

  // Revalidar server-side la grilla antes de la transacción.
  const bookable = await isBookableSlot({
    businessId: business.id,
    timezone: business.timezone,
    professionalId: appointment.professionalId,
    durationMinutes: appointment.service.durationMinutes,
    startsAt,
    endsAt,
  });

  if (!bookable) {
    return { error: "Ese horario no está dentro del horario de atención." };
  }

  try {
    await runBookingTransaction(
      appointment.professionalId,
      startsAt,
      endsAt,
      async (tx) => {
        await tx.appointment.update({
          where: { id: appointmentId },
          data: { startsAt, endsAt },
        });
      },
      { excludeAppointmentId: appointmentId }
    );
  } catch (error) {
    if (error instanceof BookingConflict || isUniqueViolation(error)) {
      return { error: "Ese horario ya no está disponible. Elegí otro." };
    }
    console.error("Error al reprogramar turno", error);
    return { error: "No se pudo reprogramar el turno. Intentalo de nuevo." };
  }

  await deletePendingRemindersForAppointment(appointmentId);

  await notifyAppointmentEvent({
    businessId: business.id,
    appointmentId,
    kind: "RESCHEDULED",
  });

  revalidatePath("/dashboard/appointments");
  return {};
}