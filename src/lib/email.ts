import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM;
const resend = apiKey ? new Resend(apiKey) : null;

function layout(
  title: string,
  bodyHtml: string,
  primaryLink?: string,
  manageLink?: string
): string {
  const buttons: string[] = [];

  if (primaryLink) {
    buttons.push(
      `<p style="margin:24px 0 0;text-align:center;">
         <a href="${primaryLink}" style="background:#18181b;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block;">Ver detalle</a>
       </p>`
    );
  }

  if (manageLink) {
    buttons.push(
      `<p style="margin:8px 0 0;text-align:center;">
         <a href="${manageLink}" style="color:#52525b;text-decoration:underline;font-size:13px;display:inline-block;">Gestionar o cancelar turno</a>
       </p>`
    );
  }

  const linksHtml = buttons.join("");

  return `<!DOCTYPE html>
<html lang="es">
<body style="margin:0;background:#f4f4f5;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:24px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #e4e4e7;border-radius:12px;overflow:hidden;">
    <div style="background:#18181b;color:#fff;padding:20px 24px;font-weight:600;">${title}</div>
    <div style="padding:24px;color:#3f3f46;font-size:15px;line-height:1.6;">
      ${bodyHtml}
      ${linksHtml}
    </div>
  </div>
</body>
</html>`;
}

export function buildAppointmentEmail(opts: {
  kind: "CONFIRMED" | "RESCHEDULED" | "CANCELLED" | "REMINDER";
  customerName: string;
  businessName: string;
  serviceName: string;
  professionalName: string;
  startsAtLocal: string;
  endsAtLocal: string;
  bookingUrl: string;
  manageUrl?: string;
}): { subject: string; text: string; html: string } {
  const {
    kind,
    customerName,
    businessName,
    serviceName,
    professionalName,
    startsAtLocal,
    endsAtLocal,
    bookingUrl,
    manageUrl,
  } = opts;

  const titleMap: Record<string, string> = {
    CONFIRMED: "Turno confirmado",
    RESCHEDULED: "Turno reprogramado",
    CANCELLED: "Turno cancelado",
    REMINDER: "Recordatorio de tu turno",
  };
  const title = titleMap[kind];

  const summary =
    `<p><strong>${serviceName}</strong> con ${professionalName}</p>` +
    `<p>${startsAtLocal} - ${endsAtLocal} hs</p>`;

  const bodyMap: Record<string, string> = {
    CONFIRMED:
      `<p>Hola ${customerName}, tu turno en <strong>${businessName}</strong> fue confirmado.</p>${summary}`,
    RESCHEDULED:
      `<p>Hola ${customerName}, tu turno en <strong>${businessName}</strong> fue reprogramado.</p>${summary}`,
    CANCELLED:
      `<p>Hola ${customerName}, tu turno en <strong>${businessName}</strong> fue cancelado.</p><p>Si necesitás un nuevo turno, podés reservar cuando quieras.</p>`,
    REMINDER:
      `<p>Hola ${customerName}, te recordamos tu turno en <strong>${businessName}</strong>.</p>${summary}`,
  };

  const text =
    `${title}\n\n${bodyMap[kind].replace(/<[^>]+>/g, "")}` +
    `\n\n${bookingUrl}` +
    (manageUrl ? `\n\nGestión de tu turno: ${manageUrl}` : "") +
    `\n\nStylo — Reservá tu turno online.`;

  return {
    subject: kind === "REMINDER" ? `Recordatorio: ${serviceName}` : `${title} - ${businessName}`,
    text,
    html: layout(title, bodyMap[kind], bookingUrl, manageUrl),
  };
}

export type BusinessAppointmentEventKind = "BOOKED" | "RESCHEDULED" | "CANCELLED";

/**
 * Email de aviso para el negocio (dueño y/o profesional): nueva reserva,
 * reprogramación o cancelación. No se envía al cliente.
 */
export function buildBusinessAppointmentEmail(opts: {
  kind: BusinessAppointmentEventKind;
  businessName: string;
  customerName: string;
  serviceName: string;
  professionalName: string;
  startsAtLocal: string;
  endsAtLocal: string;
  price: number;
}): { subject: string; text: string; html: string } {
  const {
    kind,
    businessName,
    customerName,
    serviceName,
    professionalName,
    startsAtLocal,
    endsAtLocal,
    price,
  } = opts;

  const titleMap: Record<BusinessAppointmentEventKind, string> = {
    BOOKED: "Nueva reserva",
    RESCHEDULED: "Reserva reprogramada",
    CANCELLED: "Reserva cancelada",
  };
  const title = titleMap[kind];
  const priceFormatted = `$${price.toLocaleString("es-AR")}`;

  const summary =
    `<p><strong>${serviceName}</strong> con ${professionalName}</p>` +
    `<p>${startsAtLocal} - ${endsAtLocal} hs</p>` +
    `<p>Cliente: <strong>${customerName}</strong></p>` +
    `<p>Precio: ${priceFormatted}</p>`;

  const bodyMap: Record<BusinessAppointmentEventKind, string> = {
    BOOKED: `<p>Se registró una nueva reserva en <strong>${businessName}</strong>.</p>${summary}`,
    RESCHEDULED: `<p>Un turno en <strong>${businessName}</strong> fue reprogramado.</p>${summary}`,
    CANCELLED: `<p>Un turno en <strong>${businessName}</strong> fue cancelado.</p>${summary}`,
  };

  const text =
    `${title}\n\n${bodyMap[kind].replace(/<[^>]+>/g, "")}` +
    `\n\nStylo — Gestión de turnos.`;

  return {
    subject: `${title} - ${businessName}`,
    text,
    html: layout(title, bodyMap[kind]),
  };
}

/**
 * Envía un email transaccional.
 *
 * - Sin RESEND_API_KEY (desarrollo local): solo registra el envío y devuelve
 *   éxito, para no bloquear el flujo de reservas.
 * - En producción, cualquier fallo se registra y devuelve false para que el
 *   módulo de recordatorios marque el Reminder como FAILED.
 */
export async function sendTransactionalEmail(opts: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<boolean> {
  if (!resend) {
    console.warn(`[email:simulado] ${opts.subject} -> ${opts.to}`);
    return true;
  }

  if (!from) {
    console.error("[email] EMAIL_FROM no está configurado");
    return false;
  }

  try {
    await resend.emails.send({
      from,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    });
    return true;
  } catch (error) {
    console.error("[email] fallo al enviar", error);
    return false;
  }
}