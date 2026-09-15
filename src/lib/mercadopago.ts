import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import type { SubscriptionStatus } from "@/generated/prisma/client";

const API_BASE = "https://api.mercadopago.com";

/**
 * Token de acceso de Mercado Pago. Nunca se expone al cliente.
 */
export function getMercadoPagoAccessToken(): string {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      "MERCADOPAGO_ACCESS_TOKEN no está configurado en el entorno del servidor."
    );
  }
  return token;
}

export class MercadoPagoError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details: unknown
  ) {
    super(message);
    this.name = "MercadoPagoError";
  }
}

async function request<T>(
  path: string,
  init: { method?: string; body?: unknown } = {}
): Promise<T> {
  const token = getMercadoPagoAccessToken();

  const response = await fetch(`${API_BASE}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!response.ok) {
    throw new MercadoPagoError(
      `Mercado Pago respondió ${response.status} en ${path}`,
      response.status,
      payload
    );
  }

  return payload as T;
}

export type PreapprovalPlanInput = {
  reason: string;
  transactionAmount: number;
  interval: "day" | "week" | "month" | "year";
  intervalCount: number;
  backUrl: string;
  payerEmail: string;
};

export type PreapprovalPlan = {
  id: string;
  status: string;
  reason: string;
  auto_recurring: Record<string, unknown>;
};

/**
 * Crea un plan de recurrencia (Preapproval Plan) en Mercado Pago.
 * El payer_email es el email administrador del plan (requerido por MP), no
 * necesariamente el jugador final.
 */
export async function createMercadoPagoPlan(
  input: PreapprovalPlanInput
): Promise<PreapprovalPlan> {
  const frequencyType =
    input.interval === "week"
      ? "days"
      : input.interval === "day"
        ? "days"
        : "months";

  const body = {
    reason: input.reason,
    auto_recurring: {
      frequency: input.intervalCount * (input.interval === "week" ? 7 : 1),
      frequency_type: frequencyType,
      transaction_amount: input.transactionAmount,
      currency_id: "ARS",
      billing_day: 1,
    },
    back_url: input.backUrl,
    payer_email: input.payerEmail,
  };

  return request<PreapprovalPlan>("/preapproval_plans", {
    method: "POST",
    body,
  });
}

export type PreapprovalInput = {
  preapprovalPlanId: string;
  backUrl: string;
  externalReference: string;
};

export type Preapproval = {
  id: string;
  status: string;
  reason: string;
  init_point: string;
  next_charge_date?: string;
  next_payment_date?: string;
  date_created?: string;
  external_reference?: string | null;
};

/**
 * Crea una suscripción (Preapproval) asociada a un plan de recurrencia.
 * Devuelve el id de la suscripción y el init_point (checkout alojado de MP)
 * para redirigir al cliente a pagar.
 */
export async function createMercadoPagoPreapproval(
  input: PreapprovalInput
): Promise<Preapproval> {
  return request<Preapproval>("/preapprovals", {
    method: "POST",
    body: {
      preapproval_plan_id: input.preapprovalPlanId,
      back_url: input.backUrl,
      external_reference: input.externalReference,
    },
  });
}

/**
 * Consulta el estado actual de una suscripción en Mercado Pago.
 * Es la fuente de verdad para actualizar el estado local.
 */
export async function getMercadoPagoPreapproval(
  subscriptionId: string
): Promise<Preapproval> {
  return request<Preapproval>(`/preapprovals/${subscriptionId}`);
}

export type MercadoPagoSubscriptionState =
  | "PENDING"
  | "AUTHORIZED"
  | "PAUSED"
  | "CANCELLED";

/**
 * Mapea el estado reportado por Mercado Pago al estado local de Subscription.
 * Estados desconocidos o intermedios se conservan como PENDING (sin inventar
 * transiciones).
 */
export function mapMercadoPagoStatus(
  mpStatus: string | null | undefined
): SubscriptionStatus {
  switch (mpStatus) {
    case "AUTHORIZED":
      return "ACTIVE";
    case "PAUSED":
      return "PAST_DUE";
    case "CANCELLED":
      return "CANCELLED";
    case "PENDING":
    default:
      return "PENDING";
  }
}

/**
 * Verifica la firma de un webhook de Mercado Pago (x-signature).
 *
 * Mercado Pago firma con HMAC-SHA256 sobre la cadena
 * `id:<data.id>;request-id:<x-request-id>;ts:<ts>` usando el secret del
 * webhook configurado en el panel. La comparación usa timingSafeEqual para
 * evitar ataques de temporización.
 */
export function verifyWebhookSignature(params: {
  dateId: string | null | undefined;
  xRequestId: string | null | undefined;
  xSignature: string | null | undefined;
  secret: string;
}): { valid: boolean; reason?: string } {
  const { dateId, xRequestId, xSignature, secret } = params;

  const ts = xSignature?.match(/(?:^|,|;)\s*ts=(\d+)/)?.[1];
  const receivedHash = xSignature?.match(/(?:^|,|;)\s*v1=([0-9a-f]+)/)?.[1];

  if (!ts || !receivedHash || !dateId || !xRequestId) {
    return { valid: false, reason: "Faltan datos de firma." };
  }

  const manifest = `id:${dateId};request-id:${xRequestId};ts:${ts}`;
  const computed = createHmac("sha256", secret).update(manifest).digest("hex");

  const receivedBuffer = Buffer.from(receivedHash, "hex");
  const computedBuffer = Buffer.from(computed, "hex");

  if (
    receivedBuffer.length !== computedBuffer.length ||
    !timingSafeEqual(receivedBuffer, computedBuffer)
  ) {
    return { valid: false, reason: "Firma inválida." };
  }

  return { valid: true };
}