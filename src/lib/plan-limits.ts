import { db } from "@/lib/db";

export type PlanLimits = Record<string, number>;

function asLimits(value: unknown): PlanLimits {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  return value as PlanLimits;
}

export function getEffectiveLimit<T extends keyof PlanLimits>(
  limits: PlanLimits,
  key: T
): number | undefined {
  return limits[key];
}

/**
 * Devuelve el plan efectivo del negocio: el plan de la última suscripción
 * activa (no cancelada ni expirada). Si no hay suscripción activa devuelve
 * null, lo que en el MVP significa "sin restricciones" para no bloquear a
 * negocios en prueba.
 */
export async function getEffectivePlan(businessId: string) {
  const subscription = await db.subscription.findFirst({
    where: {
      businessId,
      status: { in: ["ACTIVE", "PENDING"] },
    },
    orderBy: { createdAt: "desc" },
    include: { plan: true },
  });

  if (!subscription || subscription.status !== "ACTIVE") {
    return null;
  }

  return subscription.plan;
}

/**
 * Suma profesional: verifica el límite maxProfessionals del plan activo.
 * El `businessId` ya fue validado por el caller (multi-tenancy).
 */
export async function enforceMaxProfessionals(
  businessId: string,
  currentCount: number
): Promise<void> {
  const plan = await getEffectivePlan(businessId);
  const limit = plan ? getEffectiveLimit(asLimits(plan.limits), "maxProfessionals") : undefined;

  if (typeof limit === "number" && currentCount >= limit) {
    throw new Error(
      `Tu plan actual permite hasta ${limit} profesionales. Actualizá tu suscripción para sumar más.`
    );
  }
}