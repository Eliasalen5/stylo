import { db } from "@/lib/db";
import { sendTransactionalEmail, buildAppointmentEmail } from "@/lib/email";
import { toTimezoneComponents } from "@/lib/datetime";

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
        customer: { select: { name: true, email: true } },
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

    const message = buildAppointmentEmail({
      kind,
      customerName: customer.name,
      businessName: business.name,
      serviceName: service.name,
      professionalName: professional.name,
      startsAtLocal: `${start.dateStr} ${start.timeStr}`,
      endsAtLocal: end.timeStr,
      bookingUrl,
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