import { db } from "@/lib/db";
import { verifyAppointmentToken } from "@/lib/appointment-token";
import { isBookableSlot } from "@/lib/availability";
import { runBookingTransaction, BookingConflict } from "@/lib/booking";
import { parseStartsAt } from "@/lib/datetime";
import {
  notifyAppointmentEvent,
  notifyBusinessAppointmentEvent,
} from "@/lib/appointment-emails";
import { deletePendingRemindersForAppointment } from "@/lib/reminders";

/**
 * Autoservicio del cliente: ver, cancelar y reprogramar SU turno usando el
 * token firmado que recibe por email. No hay sesión: el token es la credencial.
 *
 * Seguridad:
 *  - El token se verifica (firma + expiración) antes de tocar la DB.
 *  - La reserva siempre se resuelve con `where: { id, customerId }`: aunque
 *    alguien posea un token, solo alcanza al turno y cliente firmados.
 *  - Reprogramar revalida server-side grilla + disponibilidad + anti doble
 *    reserva (transacción y FOR UPDATE, igual que la reserva inicial).
 *  - Los emails de aviso al cliente y al negocio se disparan como best-effort.
 */

export type PortalErrorKind = "invalid" | "not_found" | "forbidden" | "unavailable";

export type PortalError = { error: string; kind: PortalErrorKind };

export type PortalAppointment = {
  id: string;
  businessId: string;
  status: string;
  startsAt: Date;
  endsAt: Date;
  price: number;
  customer: { name: string };
  service: { id: string; name: string; durationMinutes: number };
  professional: { id: string; name: string };
  business: { name: string; slug: string; timezone: string };
};

export type GetAppointmentResult =
  | { appointment: PortalAppointment }
  | PortalError;

const MANAGEMENT_STATES = ["PENDING", "CONFIRMED"];

function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: unknown }).code === "P2002"
  );
}

/**
 * Verifica el token y devuelve el turno del cliente (scoped al customerId
 * firmado). El estado se deja intacto para que la UI decida qué mostrar.
 */
export async function getAppointmentForPortal(
  token: string
): Promise<GetAppointmentResult> {
  const payload = verifyAppointmentToken(token);
  if (!payload) return { error: "Link inválido o vencido.", kind: "invalid" };

  const appointment = await db.appointment.findFirst({
    where: { id: payload.appointmentId, customerId: payload.customerId },
    include: {
      customer: { select: { name: true } },
      service: { select: { id: true, name: true, durationMinutes: true } },
      professional: { select: { id: true, name: true } },
      business: { select: { name: true, slug: true, timezone: true } },
    },
  });

  if (!appointment) return { error: "Turno no encontrado.", kind: "not_found" };

  return { appointment };
}

/**
 * Cancela el turno del cliente. Solo se permite mientras esté pendiente o
 * confirmado y todavía no haya comenzado.
 */
export async function cancelAppointmentByToken(
  token: string,
  now = new Date()
): Promise<{ ok: true } | PortalError> {
  const payload = verifyAppointmentToken(token);
  if (!payload) return { error: "Link inválido o vencido.", kind: "invalid" };

  const appointment = await db.appointment.findFirst({
    where: { id: payload.appointmentId, customerId: payload.customerId },
    select: { id: true, businessId: true, status: true, startsAt: true },
  });

  if (!appointment) return { error: "Turno no encontrado.", kind: "not_found" };

  if (!MANAGEMENT_STATES.includes(appointment.status) || appointment.startsAt <= now) {
    return {
      error: "Este turno ya no se puede cancelar.",
      kind: "forbidden",
    };
  }

  await db.appointment.update({
    where: { id: appointment.id },
    data: { status: "CANCELLED" },
  });

  await Promise.all([
    deletePendingRemindersForAppointment(appointment.id),
    notifyAppointmentEvent({
      businessId: appointment.businessId,
      appointmentId: appointment.id,
      kind: "CANCELLED",
    }),
    notifyBusinessAppointmentEvent({
      businessId: appointment.businessId,
      appointmentId: appointment.id,
      kind: "CANCELLED",
    }),
  ]);

  return { ok: true };
}

/**
 * Reprograma el turno del cliente a una nueva fecha/hora UTC. Reutiliza la
 * transacción anti doble reserva del booking: la nueva disponibilidad se valida
 * dentro de la transacción (FOR UPDATE del profesional).
 */
export async function rescheduleAppointmentByToken(
  token: string,
  startsAtValue: string,
  now = new Date()
): Promise<{ ok: true } | PortalError> {
  const payload = verifyAppointmentToken(token);
  if (!payload) return { error: "Link inválido o vencido.", kind: "invalid" };

  const startsAt = parseStartsAt(startsAtValue);
  if (!startsAt) return { error: "Fecha y hora inválidas.", kind: "invalid" };

  const appointment = await db.appointment.findFirst({
    where: { id: payload.appointmentId, customerId: payload.customerId },
    include: {
      service: { select: { durationMinutes: true, isActive: true } },
      professional: { select: { isActive: true } },
      business: { select: { timezone: true } },
    },
  });

  if (!appointment) return { error: "Turno no encontrado.", kind: "not_found" };

  if (!MANAGEMENT_STATES.includes(appointment.status) || appointment.startsAt <= now) {
    return {
      error: "Este turno ya no se puede reprogramar.",
      kind: "forbidden",
    };
  }

  if (!appointment.service.isActive || !appointment.professional.isActive) {
    return {
      error: "El servicio o profesional ya no está disponible.",
      kind: "unavailable",
    };
  }

  const endsAt = new Date(startsAt.getTime() + appointment.service.durationMinutes * 60 * 1000);

  const bookable = await isBookableSlot({
    businessId: appointment.businessId,
    timezone: appointment.business.timezone,
    professionalId: appointment.professionalId,
    durationMinutes: appointment.service.durationMinutes,
    startsAt,
    endsAt,
  });

  if (!bookable) {
    return {
      error: "Ese horario no está dentro del horario de atención.",
      kind: "invalid",
    };
  }

  try {
    await runBookingTransaction(
      appointment.professionalId,
      startsAt,
      endsAt,
      async (tx) => {
        await tx.appointment.update({
          where: { id: appointment.id },
          data: { startsAt, endsAt },
        });
      },
      { excludeAppointmentId: appointment.id }
    );
  } catch (error) {
    if (error instanceof BookingConflict || isUniqueViolation(error)) {
      return { error: "Ese horario ya no está disponible. Elegí otro.", kind: "unavailable" };
    }
    console.error("Error al reprogramar turno (autoservicio)", error);
    return { error: "No se pudo reprogramar el turno. Intentalo de nuevo.", kind: "unavailable" };
  }

  await deletePendingRemindersForAppointment(appointment.id);

  // El email de confirmación del nuevo horario lleva un link nuevo (mismo token):
  // siempre apunta a este mismo turno, ya reprogramado.
  await Promise.all([
    notifyAppointmentEvent({
      businessId: appointment.businessId,
      appointmentId: appointment.id,
      kind: "RESCHEDULED",
    }),
    notifyBusinessAppointmentEvent({
      businessId: appointment.businessId,
      appointmentId: appointment.id,
      kind: "RESCHEDULED",
    }),
  ]);

  return { ok: true };
}