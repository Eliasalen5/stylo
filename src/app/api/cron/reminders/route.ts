import {
  scheduleUpcomingReminders,
  processDueReminders,
} from "@/lib/reminders";

export const maxDuration = 60;

/**
 * Cron de recordatorios (Vercel Cron, cada hora).
 *
 * 1. Programa Reminders PENDING para turnos confirmados dentro de 24 hs.
 * 2. Envía los Reminders vencidos (idempotente).
 *
 * Protegido con CRON_SECRET (header Authorization: Bearer). Si no existe
 * CRON_SECRET, la ruta solo responde en desarrollo.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const expected = secret ? `Bearer ${secret}` : null;
  const auth = request.headers.get("authorization");

  if (expected && auth !== expected) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!expected && process.env.NODE_ENV === "production") {
    return Response.json({ error: "Cron sin configurar" }, { status: 500 });
  }

  try {
    const scheduled = await scheduleUpcomingReminders();
    const { sent, failed } = await processDueReminders();

    return Response.json({ ok: true, scheduled, sent, failed });
  } catch (error) {
    console.error("[cron] error al procesar recordatorios", error);
    return Response.json({ ok: false }, { status: 500 });
  }
}