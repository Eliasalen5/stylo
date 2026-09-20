import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM;
const resend = apiKey ? new Resend(apiKey) : null;

/**
 * Escapa valores para insertarlos en contexto HTML (atributos o contenido).
 * Previene inyección de HTML/atributos con datos controlados por el usuario
 * (nombres de clientes/servicios, URLs, etc.).
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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
         <a href="${escapeHtml(primaryLink)}" style="background:#18181b;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block;">Ver detalle</a>
       </p>`
    );
  }

  if (manageLink) {
    buttons.push(
      `<p style="margin:8px 0 0;text-align:center;">
         <a href="${escapeHtml(manageLink)}" style="color:#52525b;text-decoration:underline;font-size:13px;display:inline-block;">Gestionar o cancelar turno</a>
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

  const safe = {
    customerName: escapeHtml(customerName),
    businessName: escapeHtml(businessName),
    serviceName: escapeHtml(serviceName),
    professionalName: escapeHtml(professionalName),
    startsAtLocal: escapeHtml(startsAtLocal),
    endsAtLocal: escapeHtml(endsAtLocal),
  };

  const summary =
    `<p><strong>${safe.serviceName}</strong> con ${safe.professionalName}</p>` +
    `<p>${safe.startsAtLocal} - ${safe.endsAtLocal} hs</p>`;

  const bodyMap: Record<string, string> = {
    CONFIRMED:
      `<p>Hola ${safe.customerName}, tu turno en <strong>${safe.businessName}</strong> fue confirmado.</p>${summary}`,
    RESCHEDULED:
      `<p>Hola ${safe.customerName}, tu turno en <strong>${safe.businessName}</strong> fue reprogramado.</p>${summary}`,
    CANCELLED:
      `<p>Hola ${safe.customerName}, tu turno en <strong>${safe.businessName}</strong> fue cancelado.</p><p>Si necesitás un nuevo turno, podés reservar cuando quieras.</p>`,
    REMINDER:
      `<p>Hola ${safe.customerName}, te recordamos tu turno en <strong>${safe.businessName}</strong>.</p>${summary}`,
  };

  const detailText = `${serviceName} con ${professionalName}\n${startsAtLocal} - ${endsAtLocal} hs`;

  const textMap: Record<string, string> = {
    CONFIRMED:
      `Hola ${customerName}, tu turno en ${businessName} fue confirmado.\n\n${detailText}`,
    RESCHEDULED:
      `Hola ${customerName}, tu turno en ${businessName} fue reprogramado.\n\n${detailText}`,
    CANCELLED:
      `Hola ${customerName}, tu turno en ${businessName} fue cancelado.\n\nSi necesitás un nuevo turno, podés reservar cuando quieras.`,
    REMINDER:
      `Hola ${customerName}, te recordamos tu turno en ${businessName}.\n\n${detailText}`,
  };

  const text =
    `${title}\n\n${textMap[kind]}` +
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

  const safe = {
    businessName: escapeHtml(businessName),
    customerName: escapeHtml(customerName),
    serviceName: escapeHtml(serviceName),
    professionalName: escapeHtml(professionalName),
    startsAtLocal: escapeHtml(startsAtLocal),
    endsAtLocal: escapeHtml(endsAtLocal),
    price: escapeHtml(priceFormatted),
  };

  const summary =
    `<p><strong>${safe.serviceName}</strong> con ${safe.professionalName}</p>` +
    `<p>${safe.startsAtLocal} - ${safe.endsAtLocal} hs</p>` +
    `<p>Cliente: <strong>${safe.customerName}</strong></p>` +
    `<p>Precio: ${safe.price}</p>`;

  const bodyMap: Record<BusinessAppointmentEventKind, string> = {
    BOOKED: `<p>Se registró una nueva reserva en <strong>${safe.businessName}</strong>.</p>${summary}`,
    RESCHEDULED: `<p>Un turno en <strong>${safe.businessName}</strong> fue reprogramado.</p>${summary}`,
    CANCELLED: `<p>Un turno en <strong>${safe.businessName}</strong> fue cancelado.</p>${summary}`,
  };

  const summaryText =
    `${serviceName} con ${professionalName}\n` +
    `${startsAtLocal} - ${endsAtLocal} hs\n` +
    `Cliente: ${customerName}\n` +
    `Precio: ${priceFormatted}`;

  const textMap: Record<BusinessAppointmentEventKind, string> = {
    BOOKED: `Se registró una nueva reserva en ${businessName}.\n\n${summaryText}`,
    RESCHEDULED: `Un turno en ${businessName} fue reprogramado.\n\n${summaryText}`,
    CANCELLED: `Un turno en ${businessName} fue cancelado.\n\n${summaryText}`,
  };

  const text =
    `${title}\n\n${textMap[kind]}` +
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
    // El SDK de Resend no lanza en errores de API/red: resuelve {data, error}.
    // Sin este chequeo, todo fallo se reportaba como envío exitoso.
    const { data, error } = await resend.emails.send({
      from,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    });

    if (error) {
      console.error("[email] fallo al enviar", error);
      return false;
    }

    return Boolean(data?.id);
  } catch (error) {
    console.error("[email] fallo al enviar", error);
    return false;
  }
}