import { db } from "@/lib/db";
import {
  sendTransactionalEmail,
  buildAppointmentEmail,
  buildBusinessAppointmentEmail,
} from "@/lib/email";
import type { BusinessAppointmentEventKind } from "@/lib/email";
import { toTimezoneComponents } from "@/lib/datetime";
import { signAppointmentToken, appointmentManageUrl } from "@/lib/appointment-token";

/**
 * Envía el email correspondiente a un evento de turno (confirmación,
 * reprogramación, cancelación) de forma best-effort: nunca debe hacer fallar la
 * operación principal. Solo se envía si el cliente tiene email y el business de
 * donde se consulta es el correcto (scoped al tenant).
 */
export async function notifyAppointmentEvent({
  businessId,
  appointmentId,
  kind,
}: {
  businessId: string;
  appointmentId: string;
  kind: "CONFIRMED" | "RESCHEDULED" | "CANCELLED";
}): Promise<void> {
  try {
    const appointment = await db.appointment.findFirst({
      where: { id: appointmentId, businessId },
      include: {
        customer: { select: { id: true, name: true, email: true } },
        service: { select: { name: true } },
        professional: { select: { name: true } },
        business: { select: { name: true, slug: true, timezone: true } },
      },
    });

    if (!appointment?.customer.email) return;

    const { business, customer, service, professional } = appointment;
    if (!customer.email) return;
    const start = toTimezoneComponents(appointment.startsAt, business.timezone);
    const end = toTimezoneComponents(appointment.endsAt, business.timezone);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const bookingUrl = `${appUrl}/${business.slug}`;

    let manageUrl: string | undefined;
    if (kind === "CONFIRMED" || kind === "RESCHEDULED") {
      const token = signAppointmentToken(appointment.id, customer.id);
      if (token) manageUrl = appointmentManageUrl(business.slug, token);
    }

    const message = buildAppointmentEmail({
      kind,
      customerName: customer.name,
      businessName: business.name,
      serviceName: service.name,
      professionalName: professional.name,
      startsAtLocal: `${start.dateStr} ${start.timeStr}`,
      endsAtLocal: end.timeStr,
      bookingUrl,
      manageUrl,
    });

    await sendTransactionalEmail({
      to: customer.email,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  } catch (error) {
    console.error("[email] no se pudo notificar el turno", error);
  }
}

/**
 * Resuelve los emails que deben enterarse de lo que pasa con un turno: los
 * OWNER del negocio (via membership) con respaldo en el email del business y
 * el profesional asignado (su email directo o el de su cuenta, si existe).
 * Deduplica destinatarios. Determinado siempre desde el servidor y scoped al
 * tenant indicado.
 */
async function resolveBusinessRecipients(params: {
  businessId: string;
  professional: { email: string | null; userId: string | null };
}): Promise<string[]> {
  const { businessId, professional } = params;

  const [members, business] = await Promise.all([
    db.businessMember.findMany({
      where: { businessId, role: "OWNER" },
      select: { user: { select: { email: true } } },
    }),
    db.business.findFirst({
      where: { id: businessId },
      select: { email: true },
    }),
  ]);

  const emails = new Set<string>();

  for (const member of members) {
    if (member.user.email) emails.add(member.user.email);
  }
  if (business?.email) emails.add(business.email);

  if (professional.email) {
    emails.add(professional.email);
  } else if (professional.userId) {
    const user = await db.user.findUnique({
      where: { id: professional.userId },
      select: { email: true },
    });
    if (user?.email) emails.add(user.email);
  }

  return [...emails];
}

/**
 * Avisa al negocio (dueño y profesional) de una nueva reserva, reprogramación
 * o cancelación. Best-effort: un fallo de email nunca debe romper el flujo
 * principal. Scoped al tenant.
 */
export async function notifyBusinessAppointmentEvent({
  businessId,
  appointmentId,
  kind,
}: {
  businessId: string;
  appointmentId: string;
  kind: BusinessAppointmentEventKind;
}): Promise<void> {
  try {
    const appointment = await db.appointment.findFirst({
      where: { id: appointmentId, businessId },
      include: {
        customer: { select: { name: true } },
        service: { select: { name: true } },
        professional: { select: { name: true, email: true, userId: true } },
        business: { select: { name: true, timezone: true } },
      },
    });

    if (!appointment) return;

    const { business, customer, service, professional } = appointment;
    const recipients = await resolveBusinessRecipients({
      businessId,
      professional: { email: professional.email, userId: professional.userId },
    });

    if (recipients.length === 0) return;

    const start = toTimezoneComponents(appointment.startsAt, business.timezone);
    const end = toTimezoneComponents(appointment.endsAt, business.timezone);

    const message = buildBusinessAppointmentEmail({
      kind,
      businessName: business.name,
      customerName: customer.name,
      serviceName: service.name,
      professionalName: professional.name,
      startsAtLocal: `${start.dateStr} ${start.timeStr}`,
      endsAtLocal: end.timeStr,
      price: appointment.price,
    });

    await Promise.allSettled(
      recipients.map((email) =>
        sendTransactionalEmail({
          to: email,
          subject: message.subject,
          text: message.text,
          html: message.html,
        })
      )
    );
  } catch (error) {
    console.error("[email] no se pudo notificar al negocio", error);
  }
}