import { db } from "@/lib/db";
import { hasConflict, isBookableSlot } from "@/lib/availability";
import {
  notifyAppointmentEvent,
  notifyBusinessAppointmentEvent,
} from "@/lib/appointment-emails";
import { Prisma } from "@/generated/prisma/client";

export type BookingErrorKind =
  | "not_found"
  | "not_offered"
  | "invalid"
  | "unavailable"
  | "internal";

export type BookingResult =
  | { id: string }
  | { error: string; kind: BookingErrorKind };

export class BookingConflict extends Error {}

function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: unknown }).code === "P2002"
  );
}

/**
 * Serializa las reservas concurrentes del mismo profesional bloqueando su fila
 * (SELECT ... FOR UPDATE) y re-chequea disponibilidad DENTRO de la transacción.
 * Esto, junto con el constraint único, elimina la doble reserva.
 */
export async function runBookingTransaction(
  professionalId: string,
  startsAt: Date,
  endsAt: Date,
  create: (tx: Prisma.TransactionClient) => Promise<void>,
  options?: { excludeAppointmentId?: string }
) {
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Professional" WHERE id = ${professionalId} FOR UPDATE`;

    const conflict = await hasConflict(
      professionalId,
      startsAt,
      endsAt,
      options?.excludeAppointmentId,
      tx
    );

    if (conflict) {
      throw new BookingConflict();
    }

    await create(tx);
  });
}

export type CreateBookingParams = {
  businessId: string;
  businessTimezone: string;
  professionalId: string;
  serviceId: string;
  customerId: string;
  startsAt: Date;
};

/**
 * Valida y crea un turno de forma segura. Es la lógica compartida entre el
 * dashboard (server action) y el booking público (API route).
 *
 * Toda validación es server-side y scoped al negocio: servicio activo,
 * profesional activo y que ofrezca el servicio, cliente del negocio, grilla
 * válida y disponibilidad sin doble reserva (transacción + FOR UPDATE).
 *
 * El precio se toma como snapshot del servicio al momento de reservar; nunca
 * desde el cliente.
 */
export async function createBooking(
  params: CreateBookingParams
): Promise<BookingResult> {
  const { businessId, businessTimezone, professionalId, serviceId, customerId, startsAt } = params;

  const [service, professional, customer] = await Promise.all([
    db.service.findFirst({
      where: { id: serviceId, businessId, isActive: true },
      select: { id: true, durationMinutes: true, price: true },
    }),
    db.professional.findFirst({
      where: { id: professionalId, businessId, isActive: true },
      select: { id: true },
    }),
    db.customer.findFirst({
      where: { id: customerId, businessId },
      select: { id: true },
    }),
  ]);

  if (!service) {
    return { error: "Servicio no encontrado o inactivo.", kind: "not_found" };
  }
  if (!professional) {
    return { error: "Profesional no encontrado o inactivo.", kind: "not_found" };
  }
  if (!customer) {
    return { error: "Cliente no encontrado.", kind: "not_found" };
  }

  const offersService = await db.professional.findFirst({
    where: {
      id: professionalId,
      services: { some: { id: serviceId } },
    },
    select: { id: true },
  });

  if (!offersService) {
    return {
      error: "El profesional no ofrece este servicio.",
      kind: "not_offered",
    };
  }

  const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60 * 1000);

  const bookable = await isBookableSlot({
    businessId,
    timezone: businessTimezone,
    professionalId,
    durationMinutes: service.durationMinutes,
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
    let id = "";

    await runBookingTransaction(professionalId, startsAt, endsAt, async (tx) => {
      const created = await tx.appointment.create({
        data: {
          businessId,
          professionalId,
          serviceId,
          customerId,
          startsAt,
          endsAt,
          price: service.price,
          // Auto-confirmación: si llegó hasta acá es porque la disponibilidad
          // ya fue validada en servidor (grilla + conflicto + FOR UPDATE).
          status: "CONFIRMED",
        },
        select: { id: true },
      });
      id = created.id;
    });

    // Best-effort: los emails nunca deben hacer fallar la reserva.
    await Promise.all([
      notifyAppointmentEvent({
        businessId,
        appointmentId: id,
        kind: "CONFIRMED",
      }),
      notifyBusinessAppointmentEvent({
        businessId,
        appointmentId: id,
        kind: "BOOKED",
      }),
    ]);

    return { id };
  } catch (error) {
    if (error instanceof BookingConflict || isUniqueViolation(error)) {
      return { error: "Ese horario ya no está disponible. Elegí otro.", kind: "unavailable" };
    }
    console.error("Error al crear turno", error);
    return { error: "No se pudo crear el turno. Intentalo de nuevo.", kind: "internal" };
  }
}