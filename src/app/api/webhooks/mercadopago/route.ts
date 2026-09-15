import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/mercadopago";
import { processMercadoPagoWebhookEvent } from "@/lib/webhooks/mercadopago-event";

export const runtime = "nodejs";

type MpPayload = {
  data?: { id?: string };
};

/**
 * Webhook de eventos de suscripción (preapproval) de Mercado Pago.
 *
 * En producción la firma (x-signature) es obligatoria: sin
 * MERCADOPAGO_WEBHOOK_SECRET configurado se rechazan los pedidos.
 * La idempotencia por evento la garantiza processMercadoPagoWebhookEvent.
 */
export async function POST(request: Request) {
  const raw = await request.text();

  if (!raw) {
    return NextResponse.json({ error: "Cuerpo vacío." }, { status: 400 });
  }

  let payload: MpPayload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET ?? "";

  if (secret) {
    const verified = verifyWebhookSignature({
      dateId: payload.data?.id,
      xRequestId: request.headers.get("x-request-id"),
      xSignature: request.headers.get("x-signature"),
      secret,
    });

    if (!verified.valid) {
      console.warn("[mercadopago] webhook con firma inválida", {
        reason: verified.reason,
      });
      return NextResponse.json({ error: "Firma inválida." }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    console.error(
      "[mercadopago] MERCADOPAGO_WEBHOOK_SECRET no está configurado en producción"
    );
    return NextResponse.json(
      { error: "Webhook no configurado." },
      { status: 503 }
    );
  } else {
    console.warn("[mercadopago] webhook recibido sin verificación (dev)");
  }

  const result = await processMercadoPagoWebhookEvent(payload);

  return NextResponse.json({ ok: true, ...result }, { status: 200 });
}