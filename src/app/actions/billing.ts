"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireCurrentOwner } from "@/lib/current-business";
import { createMercadoPagoPreapproval } from "@/lib/mercadopago";

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

/**
 * Inicia la suscripción del negocio a un plan.
 *
 * Seguridad:
 *  - El negocio se resuelve desde la sesión del servidor (nunca del frontend).
 *  - Solo un OWNER puede suscribir el negocio.
 *  - El plan debe estar activo y vinculado a su plan de recurrencia en MP.
 *  - El monto y la frecuencia provienen del plan (servidor); el cliente jamás
 *    los determina.
 */
export type SubscribeResult = { error?: string };

export async function subscribeToPlan(planId: string): Promise<SubscribeResult> {
  const business = await requireCurrentOwner();

  const plan = await db.plan.findUnique({ where: { id: planId } });
  if (!plan || !plan.isActive) {
    return { error: "El plan no está disponible." };
  }
  if (!plan.mercadoPagoPlanId) {
    return { error: "El plan aún no está vinculado a Mercado Pago." };
  }

  const activeSubscription = await db.subscription.findFirst({
    where: { businessId: business.id, status: { in: ["ACTIVE", "PENDING"] } },
  });
  if (activeSubscription) {
    return {
      error: "Este negocio ya tiene una suscripción activa o pendiente de pago.",
    };
  }

  let initPoint: string;
  try {
    const preapproval = await createMercadoPagoPreapproval({
      preapprovalPlanId: plan.mercadoPagoPlanId,
      backUrl: `${appUrl()}/dashboard/billing?mp=1`,
      externalReference: business.id,
    });
    initPoint = preapproval.init_point;

    // Guardar la referencia ANTES de redirigir al checkout para que el
    // webhook pueda reconciliar la suscripción aunque el usuario cierre la
    // página antes de completar el pago.
    await db.subscription.create({
      data: {
        businessId: business.id,
        planId: plan.id,
        status: "PENDING",
        mercadoPagoSubscriptionId: preapproval.id,
      },
    });
  } catch (error) {
    console.error("Error al iniciar suscripción", error);
    return { error: "No se pudo iniciar la suscripción. Probá nuevamente." };
  }

  redirect(initPoint);
}

export type CancelSubscriptionState = { error?: string; success?: boolean };

/**
 * Cancela la suscripción activa del negocio por decisión del OWNER.
 * El estado local se marca CANCELLED para evitar nuevas validaciones de plan;
 * la cancelación formal en Mercado Pago se hace con la API de la plataforma.
 */
export async function cancelSubscription(): Promise<CancelSubscriptionState> {
  const business = await requireCurrentOwner();

  try {
    const result = await db.subscription.updateMany({
      where: { businessId: business.id, status: { in: ["ACTIVE", "PAST_DUE"] } },
      data: { status: "CANCELLED", mpStatus: "CANCELLED_BY_OWNER", canceledAt: new Date() },
    });

    if (result.count === 0) {
      return { error: "No hay una suscripción activa para cancelar." };
    }

    return { success: true };
  } catch (error) {
    console.error("Error al cancelar suscripción", error);
    return { error: "No se pudo cancelar la suscripción." };
  }
}