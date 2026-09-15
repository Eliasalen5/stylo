"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import {
  createMercadoPagoPlan,
  getMercadoPagoAccessToken,
} from "@/lib/mercadopago";
import type { SubscriptionInterval } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";

const INTERVALS: SubscriptionInterval[] = ["DAY", "WEEK", "MONTH", "YEAR"];

export type PlanState = {
  error?: string;
  success?: boolean;
  fieldErrors?: Partial<Record<"name" | "price" | "interval" | "limits", string>>;
};

function parsePlanForm(
  formData: FormData
): {
  name: string;
  description: string | null;
  price: number;
  interval: SubscriptionInterval;
  intervalCount: number;
  limits: Record<string, number> | null;
  fieldErrors: NonNullable<PlanState["fieldErrors"]>;
} {
  const fieldErrors: NonNullable<PlanState["fieldErrors"]> = {};

  const name = formData.get("name")?.toString().trim() ?? "";
  const description = formData.get("description")?.toString().trim() || null;

  const price = Number(formData.get("price"));
  const intervalRaw = formData.get("interval")?.toString() ?? "";
  const intervalCount = Number(formData.get("intervalCount") ?? "1");

  if (!name) {
    fieldErrors.name = "El nombre es obligatorio.";
  } else if (name.length > 80) {
    fieldErrors.name = "El nombre no puede superar los 80 caracteres.";
  }

  if (!Number.isInteger(price) || price < 0) {
    fieldErrors.price = "El precio debe ser un monto en pesos entero.";
  }

  if (!INTERVALS.includes(intervalRaw as SubscriptionInterval)) {
    fieldErrors.interval = "Seleccioná un intervalo válido.";
  }

  let limits: Record<string, number> | null = null;
  const limitsRaw = formData.get("limits")?.toString().trim();
  if (limitsRaw) {
    try {
      const parsed: unknown = JSON.parse(limitsRaw);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        fieldErrors.limits = "Los límites deben ser un objeto JSON, ej: {\"maxProfessionals\": 3}.";
      } else {
        const record: Record<string, number> = {};
        for (const [key, value] of Object.entries(parsed)) {
          if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
            fieldErrors.limits = "Los valores de límites deben ser números positivos.";
            break;
          }
          record[key] = value;
        }
        limits = record;
      }
    } catch {
      fieldErrors.limits = "Los límites no son un JSON válido.";
    }
  }

  const interval = intervalRaw as SubscriptionInterval;
  const validIntervalCount = Number.isInteger(intervalCount) && intervalCount >= 1 && intervalCount <= 12;

  return {
    name,
    description,
    price,
    interval,
    intervalCount: validIntervalCount ? intervalCount : 1,
    limits,
    fieldErrors,
  };
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export async function createPlan(
  _prevState: PlanState,
  formData: FormData
): Promise<PlanState> {
  const admin = await requirePlatformAdmin();

  const parsed = parsePlanForm(formData);
  if (Object.keys(parsed.fieldErrors).length > 0) {
    return { fieldErrors: parsed.fieldErrors };
  }

  try {
    // Un plan de pago requiere el vault de recurrencia en Mercado Pago.
    // Sin token configurado, no se publican planes cobrables.
    getMercadoPagoAccessToken();

    const mpInterval = parsed.interval.toLowerCase() as "day" | "week" | "month" | "year";
    const mercadoPagoPlan = await createMercadoPagoPlan({
      reason: parsed.name,
      transactionAmount: parsed.price,
      interval: mpInterval,
      intervalCount: parsed.intervalCount,
      backUrl: `${appUrl()}/dashboard/billing?mp=1`,
      payerEmail: process.env.MERCADOPAGO_OWNER_EMAIL ?? admin.email,
    });

    await db.plan.create({
      data: {
        name: parsed.name,
        description: parsed.description,
        price: parsed.price,
        interval: parsed.interval,
        intervalCount: parsed.intervalCount,
limits: parsed.limits ?? Prisma.DbNull,
        mercadoPagoPlanId: mercadoPagoPlan.id,
      },
    });

    revalidatePath("/admin/plans");
    return { success: true };
  } catch (error) {
    console.error("Error al crear plan", error);
    return { error: "No se pudo crear el plan. Verificá la configuración de Mercado Pago." };
  }
}

export async function updatePlan(
  planId: string,
  _prevState: PlanState,
  formData: FormData
): Promise<PlanState> {
  const admin = await requirePlatformAdmin();

  const parsed = parsePlanForm(formData);
  if (Object.keys(parsed.fieldErrors).length > 0) {
    return { fieldErrors: parsed.fieldErrors };
  }

  try {
    const existing = await db.plan.findUnique({ where: { id: planId } });
    if (!existing) {
      return { error: "El plan no existe." };
    }

    const priceChanged = existing.price !== parsed.price;
    const intervalChanged =
      existing.interval !== parsed.interval ||
      existing.intervalCount !== parsed.intervalCount;

    if ((priceChanged || intervalChanged) && existing.mercadoPagoPlanId) {
      const subscriptionCount = await db.subscription.count({
        where: { planId, NOT: { status: "CANCELLED" } },
      });
      if (subscriptionCount > 0) {
        return {
          error: "El plan ya tiene suscripciones activas: no se puede modificar el precio ni la frecuencia. Creá un plan nuevo.",
        };
      }
    }

    const data: Parameters<typeof db.plan.update>[0]["data"] = {
      name: parsed.name,
      description: parsed.description,
      price: parsed.price,
      interval: parsed.interval,
      intervalCount: parsed.intervalCount,
      limits: parsed.limits ?? Prisma.DbNull,
    };

    // Si aún no hay plan de recurrencia en MP, crearlo al fijar condiciones de pago.
    if (priceChanged || intervalChanged || !existing.mercadoPagoPlanId) {
      getMercadoPagoAccessToken();
      const mpInterval = parsed.interval.toLowerCase() as "day" | "week" | "month" | "year";
      const mercadoPagoPlan = await createMercadoPagoPlan({
        reason: parsed.name,
        transactionAmount: parsed.price,
        interval: mpInterval,
        intervalCount: parsed.intervalCount,
        backUrl: `${appUrl()}/dashboard/billing?mp=1`,
        payerEmail: process.env.MERCADOPAGO_OWNER_EMAIL ?? admin.email,
      });
      data.mercadoPagoPlanId = mercadoPagoPlan.id;
    }

    await db.plan.update({ where: { id: planId }, data });

    revalidatePath(`/admin/plans/${planId}`);
    revalidatePath("/admin/plans");
    return { success: true };
  } catch (error) {
    console.error("Error al actualizar plan", error);
    return { error: "No se pudo actualizar el plan." };
  }
}

export async function togglePlanActive(
  planId: string,
  isActive: boolean
): Promise<void> {
  await requirePlatformAdmin();

  const plan = await db.plan.findUnique({ where: { id: planId } });
  if (!plan) return;

  await db.plan.update({
    where: { id: planId },
    data: { isActive },
  });

  revalidatePath(`/admin/plans/${planId}`);
  revalidatePath("/admin/plans");
}