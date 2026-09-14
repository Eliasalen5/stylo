import { db } from "@/lib/db";
import { sendTransactionalEmail, buildAppointmentEmail } from "@/lib/email";
import { toTimezoneComponents } from "@/lib/datetime";

export const REMINDER_WINDOW_HOURS = 24;

/**
 * Programa Reminders PENDING para los turnos CONFIRMED que empiezan dentro de
 * la ventana de recordatorio (por defecto 24 hs). Es idempotente gracias al
 * constraint único @@unique([appointmentId, channel, scheduledAt]).
 */
export async function scheduleUpcomingReminders(now = new Date()): Promise<number> {
  const horizon = new Date(
    now.getTime() + REMINDER_WINDOW_HOURS * 60 * 60 * 1000
  );

  const appointments = await db.appointment.findMany({
    where: {
      status: "CONFIRMED",
      startsAt: { gt: now, lte: horizon },
      customer: { email: { not: null } },
    },
    select: {
      id: true,
      businessId: true,
      customerId: true,
      startsAt: true,
    },
  });

  let scheduled = 0;

  for (const appointment of appointments) {
    const scheduledAt = new Date(
      appointment.startsAt.getTime() - REMINDER_WINDOW_HOURS * 60 * 60 * 1000
    );

    const created = await db.reminder.upsert({
      where: {
        appointmentId_channel_scheduledAt: {
          appointmentId: appointment.id,
          channel: "EMAIL",
          scheduledAt,
        },
      },
      update: {},
      create: {
        businessId: appointment.businessId,
        appointmentId: appointment.id,
        customerId: appointment.customerId,
        channel: "EMAIL",
        status: "PENDING",
        scheduledAt,
      },
    });

    // Si el upsert creó (es la primera vez) cuenta como programado; si ya
    // existía para esa hora, es un no-op idempotente.
    if (created.status === "PENDING") scheduled += 1;
  }

  return scheduled;
}

/**
 * Procesa los Reminders PENDING cuyo scheduledAt ya pasó y cuyo turno sigue
 * confirmado y futuro. Envía el email y marca SENT o FAILED (idempotente: un
 * Reminder solo se envía una vez).
 */
export async function processDueReminders(now = new Date()): Promise<{
  sent: number;
  failed: number;
}> {
  const due = await db.reminder.findMany({
    where: {
      status: "PENDING",
      scheduledAt: { lte: now },
      appointment: {
        status: "CONFIRMED",
        startsAt: { gt: now },
      },
    },
    include: {
      customer: { select: { name: true, email: true } },
      appointment: {
        select: {
          startsAt: true,
          endsAt: true,
          service: { select: { name: true } },
          professional: { select: { name: true } },
          business: { select: { name: true, slug: true, timezone: true } },
        },
      },
    },
  });

  let sent = 0;
  let failed = 0;

  for (const reminder of due) {
    const { appointment, customer } = reminder;
    const email = customer.email;

    let ok = false;
    if (email) {
      const start = toTimezoneComponents(appointment.startsAt, appointment.business.timezone);
      const end = toTimezoneComponents(appointment.endsAt, appointment.business.timezone);

      const message = buildAppointmentEmail({
        kind: "REMINDER",
        customerName: customer.name,
        businessName: appointment.business.name,
        serviceName: appointment.service.name,
        professionalName: appointment.professional.name,
        startsAtLocal: `${start.dateStr} ${start.timeStr}`,
        endsAtLocal: end.timeStr,
        bookingUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/${appointment.business.slug}`,
      });

      ok = await sendTransactionalEmail({
        to: email,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
    }

    await db.reminder.update({
      where: { id: reminder.id },
      data: ok
        ? { status: "SENT", sentAt: now }
        : { status: "FAILED", failedAt: now, error: email ? "send_failed" : "missing_email" },
    });

    if (ok) sent += 1;
    else failed += 1;
  }

  return { sent, failed };
}

/**
 * Elimina los recordatorios pendientes de un turno (al reprogramar, cancelar o
 * completar). Los SENT se conservan como historial.
 */
export async function deletePendingRemindersForAppointment(
  appointmentId: string
): Promise<void> {
  await db.reminder.deleteMany({
    where: { appointmentId, status: "PENDING" },
  });
}