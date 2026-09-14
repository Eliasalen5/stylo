import { db } from "@/lib/db";
import {
  toTimezoneComponents,
  toMinutes,
  localToUTC,
  addMinutes,
  compareTime,
} from "@/lib/datetime";
import { Prisma, type WeekDay } from "@/generated/prisma/client";

export type TimeSlot = {
  startTime: string; // "HH:MM" en timezone del negocio
  endTime: string; // "HH:MM" en timezone del negocio
  startsAtUTC: Date;
  endsAtUTC: Date;
};

const SLOT_GRANULARITY = 30; // minutos

export const WEEKDAY_TO_INDEX: Record<WeekDay, number> = {
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
  SUNDAY: 0,
};

/**
 * Resuelve las franjas horarias efectivas para un profesional en un día dado.
 *
 * Si el profesional tiene sus propios BusinessHours para ese día, se usan.
 * Si no, se usan los del negocio (professionalId = NULL).
 * Solo se devuelven franjas activas.
 */
export async function getEffectiveHours(
  businessId: string,
  professionalId: string,
  dayOfWeek: WeekDay
): Promise<{ startTime: string; endTime: string }[]> {
  const professionalHours = await db.businessHours.findMany({
    where: {
      businessId,
      professionalId,
      dayOfWeek,
      isActive: true,
    },
  });

  if (professionalHours.length > 0) {
    return professionalHours.map((h) => ({
      startTime: h.startTime,
      endTime: h.endTime,
    }));
  }

  const businessHours = await db.businessHours.findMany({
    where: {
      businessId,
      professionalId: null,
      dayOfWeek,
      isActive: true,
    },
  });

  return businessHours.map((h) => ({
    startTime: h.startTime,
    endTime: h.endTime,
  }));
}

/**
 * Obtiene los turnos existentes (PENDING/CONFIRMED) para un profesional en un
 * día dado. Devuelve los instantes reales en UTC de cada turno.
 *
 * Usa un predicado de superposición (overlap) sobre la ventana del día, no de
 * contención: así los turnos que cruzan la frontera del día (empiezan el día
 * anterior o terminan en el siguiente) se cuentan correctamente.
 */
async function getExistingAppointments(
  professionalId: string,
  dayStartUTC: Date,
  dayEndUTC: Date
): Promise<{ startsAt: Date; endsAt: Date }[]> {
  const appointments = await db.appointment.findMany({
    where: {
      professionalId,
      status: { in: ["PENDING", "CONFIRMED"] },
      startsAt: { lt: dayEndUTC },
      endsAt: { gt: dayStartUTC },
    },
    select: {
      startsAt: true,
      endsAt: true,
    },
  });

  return appointments.map((a) => ({
    startsAt: a.startsAt,
    endsAt: a.endsAt,
  }));
}

/**
 * Genera los slots disponibles para un día específico.
 *
 * @param businessId - ID del negocio
 * @param professionalId - ID del profesional
 * @param serviceId - ID del servicio (para saber la duración)
 * @param dateStr - Fecha en formato "YYYY-MM-DD" en la timezone del negocio
 * @returns Array de slots disponibles
 */
export async function getAvailableSlots(
  businessId: string,
  professionalId: string,
  serviceId: string,
  dateStr: string
): Promise<TimeSlot[]> {
  // 1. Datos del negocio, servicio y profesional, todos scoped al tenant.
  const [business, service, professional] = await Promise.all([
    db.business.findUnique({
      where: { id: businessId },
      select: { timezone: true },
    }),
    db.service.findFirst({
      where: { id: serviceId, businessId },
      select: { durationMinutes: true },
    }),
    db.professional.findFirst({
      where: {
        id: professionalId,
        businessId,
        services: { some: { id: serviceId } },
      },
      select: { id: true },
    }),
  ]);

  if (!business || !service || !professional) return [];

  const tz = business.timezone;
  const duration = service.durationMinutes;

  // 2. Determinar el día de la semana
  const [year, month, day] = dateStr.split("-").map(Number);
  const dateObj = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const jsDay = dateObj.getUTCDay(); // 0=Sunday
  const weekdayByIndex = Object.entries(WEEKDAY_TO_INDEX).find(
    ([, idx]) => idx === jsDay
  )?.[0] as WeekDay | undefined;

  if (!weekdayByIndex) return [];

  // 3. Obtener franjas horarias efectivas
  const hours = await getEffectiveHours(businessId, professionalId, weekdayByIndex);
  if (hours.length === 0) return [];

  // 4. Ventana del día en la timezone del negocio (medianoche local a medianoche local)
  const dayStartUTC = localToUTC(dateStr, "00:00", tz);
  const dayEndUTC = localToUTC(dateStr, "24:00", tz);

  // 5. Obtener turnos existentes
  const occupied = await getExistingAppointments(
    professionalId,
    dayStartUTC,
    dayEndUTC
  );

  // 6. Generar todos los slots posibles
  const allSlots: { startTime: string; endTime: string }[] = [];

  for (const range of hours) {
    let current = range.startTime;
    while (true) {
      const end = addMinutes(current, duration);
      if (compareTime(end, range.endTime) > 0) break;

      allSlots.push({ startTime: current, endTime: end });
      current = addMinutes(current, SLOT_GRANULARITY);
    }
  }

  // 7. Convertir a instantes reales en UTC y filtrar slots ocupados.
  // La comparación se hace sobre instantes (Date), no sobre strings: así los
  // turnos que cruzan la medianoche se detectan correctamente.
  const available = allSlots
    .map((slot) => ({
      startTime: slot.startTime,
      endTime: slot.endTime,
      startsAtUTC: localToUTC(dateStr, slot.startTime, tz),
      endsAtUTC: localToUTC(dateStr, slot.endTime, tz),
    }))
    .filter((slot) => {
      return !occupied.some(
        (appt) =>
          slot.startsAtUTC.getTime() < appt.endsAt.getTime() &&
          slot.endsAtUTC.getTime() > appt.startsAt.getTime()
      );
    });

  return available;
}

/**
 * Verifica que un rango [startsAt, endsAt] sea un slot válido de la grilla:
 *  - Empieza alineado a la grilla de 30 minutos.
 *  - Dura exactamente lo que dura el servicio.
 *  - Cae dentro de una franja horaria efectiva (del profesional o del negocio)
 *    en la timezone del negocio, sin cruzar la medianoche.
 *
 * Es la revalidación server-side que impide reservar horarios que el frontend
 * nunca mostró (AGENTS.md 14).
 */
export async function isBookableSlot(params: {
  businessId: string;
  timezone: string;
  professionalId: string;
  durationMinutes: number;
  startsAt: Date;
  endsAt: Date;
}): Promise<boolean> {
  const { businessId, timezone, professionalId, durationMinutes, startsAt, endsAt } = params;

  // Duración exacta
  if (endsAt.getTime() - startsAt.getTime() !== durationMinutes * 60 * 1000) {
    return false;
  }

  const localStart = toTimezoneComponents(startsAt, timezone);
  const localEnd = toTimezoneComponents(endsAt, timezone);

  // No se admiten turnos que crucen la medianoche (coherente con la grilla).
  if (localStart.dateStr !== localEnd.dateStr) return false;

  // Inicio alineado a la grilla de 30 minutos
  if (localStart.minute % SLOT_GRANULARITY !== 0) return false;

  const hours = await getEffectiveHours(
    businessId,
    professionalId,
    localStart.weekday as WeekDay
  );
  if (hours.length === 0) return false;

  const startMin = toMinutes(localStart.timeStr);
  const endMin = toMinutes(localEnd.timeStr);

  return hours.some((range) => {
    const rangeStart = toMinutes(range.startTime);
    const rangeEnd = toMinutes(range.endTime);
    return startMin >= rangeStart && endMin <= rangeEnd;
  });
}

/**
 * Verifica si hay conflicto para un rango horario específico.
 * Se usa para doble validación en server actions, idealmente dentro de una
 * transacción (se acepta un client de transacción opcional).
 */
export async function hasConflict(
  professionalId: string,
  startsAt: Date,
  endsAt: Date,
  excludeAppointmentId?: string,
  tx?: Prisma.TransactionClient
): Promise<boolean> {
  const client = tx ?? db;
  const where: Prisma.AppointmentWhereInput = {
    professionalId,
    status: { in: ["PENDING", "CONFIRMED"] },
    startsAt: { lt: endsAt },
    endsAt: { gt: startsAt },
  };

  if (excludeAppointmentId) {
    where.id = { not: excludeAppointmentId };
  }

  const count = await client.appointment.count({ where });
  return count > 0;
}