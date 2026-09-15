import { db } from "@/lib/db";
import {
  getMercadoPagoPreapproval,
  mapMercadoPagoStatus,
} from "@/lib/mercadopago";
import type { Prisma } from "@/generated/prisma/client";

export type MercadoPagoWebhookPayload = {
  id?: string;
  type?: string;
  data?: {
    id?: string;
    status?: string;
    date_created?: string;
    next_charge_date?: string;
    next_payment_date?: string;
    start_date?: string;
  };
};

export type WebhookProcessResult = {
  outcome: "processed" | "duplicate" | "ignored";
  subscriptionId?: string;
};

function parseDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function buildSubscriptionUpdate(
  data: MercadoPagoWebhookPayload["data"],
  snapshot: {
    status: string;
    mpStatus: string | null;
    canceledAt: Date | null;
  }
): Prisma.SubscriptionUpdateInput {
  const now = new Date();
  const update: Prisma.SubscriptionUpdateInput = {};

  const rawStatus = typeof data?.status === "string" ? data.status : undefined;
  if (rawStatus) update.mpStatus = rawStatus;

  // Una suscripción cancelada no se reactiva con eventos atrasados.
  const mapped = snapshot.status === "CANCELLED" ? "CANCELLED" : mapMercadoPagoStatus(rawStatus ?? snapshot.mpStatus);
  update.status = mapped;

  const periodStart = parseDate(data?.start_date ?? data?.date_created);
  const periodEnd = parseDate(data?.next_charge_date ?? data?.next_payment_date);

  if (periodStart) update.currentPeriodStart = periodStart;
  if (periodEnd) update.currentPeriodEnd = periodEnd;

  if (mapped === "CANCELLED" && !snapshot.canceledAt) {
    update.canceledAt = now;
  }

  return update;
}

/**
 * Procesa un evento de webhook de Mercado Pago con garantía de idempotencia.
 *
 * Cada evento (mpEventId) se registra en SubscriptionEvent con clave única, de
 * modo que los reintentos de Mercado Pago no producen efectos duplicados.
 * El estado de la Subscription se deriva del payload y, cuando el payload no
 * trae estado (p. ej. subscription_charged), se consulta la fuente de verdad
 * en la API de Mercado Pago mediante `fetchPreapproval`.
 */
export async function processMercadoPagoWebhookEvent(
  payload: MercadoPagoWebhookPayload,
  options?: {
    fetchPreapproval?: (subscriptionMpId: string) => Promise<{
      status?: string;
      date_created?: string;
      next_charge_date?: string;
      next_payment_date?: string;
    }>;
  }
): Promise<WebhookProcessResult> {
  const eventType = payload.type;
  const mpEventId = payload.id;
  const mpSubscriptionId = payload.data?.id;

  if (!eventType || !mpEventId || !mpSubscriptionId) {
    console.warn("[mercadopago] webhook sin datos esperados", {
      eventType,
      mpEventId,
      mpSubscriptionId,
    });
    return { outcome: "ignored" };
  }

  const subscription = await db.subscription.findFirst({
    where: { mercadoPagoSubscriptionId: mpSubscriptionId },
  });

  if (!subscription) {
    console.warn("[mercadopago] evento de suscripción desconocida", {
      mpSubscriptionId,
      mpEventId,
      eventType,
    });
    return { outcome: "ignored" };
  }

  try {
    let data = payload.data;

    // Los cobros (subscription_charged) suelen llegar sin estado. Consultar
    // la API de MP para no inventar transiciones.
    if (!data?.status) {
      const fetchPreapproval =
        options?.fetchPreapproval ??
        (() => getMercadoPagoPreapproval(mpSubscriptionId));
      const remote = await fetchPreapproval(mpSubscriptionId);
      data = {
        ...data,
        status: remote.status,
        start_date: remote.date_created,
        next_charge_date: remote.next_charge_date,
        next_payment_date: remote.next_payment_date,
      };
    }

    const result = await db.$transaction(async (tx) => {
      const existing = await tx.subscriptionEvent.findUnique({
        where: { mpEventId },
      });

      if (existing) {
        return { outcome: "duplicate" as const };
      }

      await tx.subscription.update({
        where: { id: subscription.id },
        data: buildSubscriptionUpdate(data, {
          status: subscription.status,
          mpStatus: subscription.mpStatus,
          canceledAt: subscription.canceledAt,
        }),
      });

      await tx.subscriptionEvent.create({
        data: {
          subscriptionId: subscription.id,
          eventType,
          mpEventId,
          payload: payload as unknown as Prisma.InputJsonValue,
        },
      });

      return { outcome: "processed" as const };
    });

    return { ...result, subscriptionId: subscription.id };
  } catch (error) {
    // Dos entregas simultáneas del mismo evento: si el evento ya quedó
    // registrado, se trata de un duplicado y no un error real.
    const isDuplicate =
      (error as { code?: string })?.code === "P2002" &&
      (error as { meta?: { target?: string[] } })?.meta?.target?.includes(
        "mpEventId"
      );

    if (isDuplicate) {
      return { outcome: "duplicate", subscriptionId: subscription.id };
    }

    console.error("[mercadopago] error procesando webhook", {
      error,
      eventType,
      mpEventId,
    });
    throw error;
  }
}