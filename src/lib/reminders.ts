import { db } from "@/lib/db";
import { sendTransactionalEmail, buildAppointmentEmail } from "@/lib/email";
import { toTimezoneComponents } from "@/lib/datetime";
import { signAppointmentToken, appointmentManageUrl } from "@/lib/appointment-token";

export const REMINDER_WINDOW_HOURS = 24;

// Un reminder queda en PROCESSING solo mientras se envía el email. Si la
// corrida del cron muere a mitad de camino, la siguiente lo recupera
// reenviándolo (al menos una vez, nunca dos por la misma corrida). Este umbral
// evita reclamar filas de una corrida todavía viva.
const PROCESSING_STALE_MS = 30 * 60 * 1000;

function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: unknown }).code === "P2002"
  );
}

/**
 * Programa Reminders para los turnos CONFIRMED que empiezan dentro de la
 * ventana de recordatorio (por defecto 24 hs). Es idempotente: el constraint
 * único @@unique([appointmentId, channel, scheduledAt]) impide duplicar filas.
 *
 * Además reactiva (FAILED → PENDING) los recordatorios que fallaron en un run
 * anterior, solo si el turno sigue confirmado y futuro, para reintentarlos.
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

    // Reintento de recordatorios que fallaron: se reactivan solo si el turno
    // sigue confirmado y futuro. Las filas SENT nunca se tocan.
    await db.reminder.updateMany({
      where: {
        appointmentId: appointment.id,
        channel: "EMAIL",
        scheduledAt,
        status: "FAILED",
        appointment: { status: "CONFIRMED", startsAt: { gt: now } },
      },
      data: { status: "PENDING" },
    });

    // Crear el recordatorio si no existe. Si ya está programado (PENDING/SENT)
    // o acaba de reactivarse (FAILED → PENDING), el create choca contra el
    // unique constraint y se ignora: nunca se duplican filas.
    try {
      await db.reminder.create({
        data: {
          businessId: appointment.businessId,
          appointmentId: appointment.id,
          customerId: appointment.customerId,
          channel: "EMAIL",
          status: "PENDING",
          scheduledAt,
        },
      });
      scheduled += 1;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }

  return scheduled;
}

/**
 * Procesa los Reminders que vencen y cuyo turno sigue confirmado y futuro.
 *
 * Anti-duplicación: cada recordatorio se reclama atómicamente (PENDING o
 * PROCESSING viejo → PROCESSING) antes de enviar. Si dos corridas del cron se
 * solapan, solo la primera en reclamar envía; la otra encuentra la fila ya
 * reclamada y la salta.
 */
export async function processDueReminders(now = new Date()): Promise<{
  sent: number;
  failed: number;
}> {
  const staleCutoff = new Date(now.getTime() - PROCESSING_STALE_MS);

  const due = await db.reminder.findMany({
    where: {
      OR: [
        { status: "PENDING", scheduledAt: { lte: now } },
        // Recuperar corridas muertas: PROCESSING colgado por más del umbral.
        { status: "PROCESSING", updatedAt: { lt: staleCutoff } },
      ],
      appointment: {
        status: "CONFIRMED",
        startsAt: { gt: now },
      },
      customer: { email: { not: null } },
    },
    include: {
      customer: { select: { id: true, name: true, email: true } },
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
    // Claim atómico: solo la corrida cuyo updateMany gana el cambio a
    // PROCESSING envía el email. Las corridas en paralelo ven count === 0.
    const claimed = await db.reminder.updateMany({
      where: { id: reminder.id, status: { in: ["PENDING", "PROCESSING"] } },
      data: { status: "PROCESSING" },
    });
    if (claimed.count === 0) continue;

    const { appointment, customer } = reminder;
    const email = customer.email;

    let ok = false;
    if (email) {
      const start = toTimezoneComponents(appointment.startsAt, appointment.business.timezone);
      const end = toTimezoneComponents(appointment.endsAt, appointment.business.timezone);

      const token = signAppointmentToken(reminder.appointmentId, reminder.customerId);
      const manageUrl = token
        ? appointmentManageUrl(appointment.business.slug, token)
        : undefined;

      const message = buildAppointmentEmail({
        kind: "REMINDER",
        customerName: customer.name,
        businessName: appointment.business.name,
        serviceName: appointment.service.name,
        professionalName: appointment.professional.name,
        startsAtLocal: `${start.dateStr} ${start.timeStr}`,
        endsAtLocal: end.timeStr,
        bookingUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/${appointment.business.slug}`,
        manageUrl,
      });

      ok = await sendTransactionalEmail({
        to: email,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
    }

    // Cierre del claim condicionado a PROCESSING: no pisa el resultado de una
    // corrida que por otra vía haya avanzado esta fila.
    await db.reminder.updateMany({
      where: { id: reminder.id, status: "PROCESSING" },
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
 * completar). Incluye PROCESSING para no mandar recordatorios de turnos que
 * ya no aplican mientras se estaban enviando. Los SENT se conservan.
 */
export async function deletePendingRemindersForAppointment(
  appointmentId: string
): Promise<void> {
  await db.reminder.deleteMany({
    where: { appointmentId, status: { in: ["PENDING", "PROCESSING"] } },
  });
}