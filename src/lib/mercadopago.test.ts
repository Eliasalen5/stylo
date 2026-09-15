import { describe, it, expect } from "vitest";
import {
  verifyWebhookSignature,
  mapMercadoPagoStatus,
} from "@/lib/mercadopago";
import { createHmac } from "node:crypto";

function sign(secret: string, manifest: string): string {
  return createHmac("sha256", secret).update(manifest).digest("hex");
}

describe("verifyWebhookSignature", () => {
  const secret = "webhook-secret-de-prueba";
  const dateId = "1366179852";
  const xRequestId = "b0b7d8d8-2b8f-4a9a-9b7e-5f4d4c3f2b1a";
  const ts = "1740155228";
  const manifest = `id:${dateId};request-id:${xRequestId};ts:${ts}`;
  const v1 = sign(secret, manifest);

  it("acepta una firma válida", () => {
    const result = verifyWebhookSignature({
      dateId,
      xRequestId,
      xSignature: `ts=${ts},v1=${v1}`,
      secret,
    });
    expect(result.valid).toBe(true);
  });

  it("rechaza una firma con hash distinto", () => {
    const result = verifyWebhookSignature({
      dateId,
      xRequestId,
      xSignature: `ts=${ts},v1=${"0".repeat(64)}`,
      secret,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Firma inválida.");
  });

  it("rechaza cuando faltan partes de la firma", () => {
    const result = verifyWebhookSignature({
      dateId,
      xRequestId,
      xSignature: `v1=${v1}`,
      secret,
    });
    expect(result.valid).toBe(false);
  });

  it("rechaza cuando el secret usado difiere del que firmó", () => {
    const otherHash = sign("otro-secret", manifest);
    const result = verifyWebhookSignature({
      dateId,
      xRequestId,
      xSignature: `ts=${ts},v1=${otherHash}`,
      secret,
    });
    expect(result.valid).toBe(false);
  });
});

describe("mapMercadoPagoStatus", () => {
  it("mapea AUTHORIZED a ACTIVE", () => {
    expect(mapMercadoPagoStatus("AUTHORIZED")).toBe("ACTIVE");
  });

  it("mapea PAUSED a PAST_DUE", () => {
    expect(mapMercadoPagoStatus("PAUSED")).toBe("PAST_DUE");
  });

  it("mapea CANCELLED a CANCELLED", () => {
    expect(mapMercadoPagoStatus("CANCELLED")).toBe("CANCELLED");
  });

  it("no inventa estados desconocidos o nulos", () => {
    expect(mapMercadoPagoStatus("RARO")).toBe("PENDING");
    expect(mapMercadoPagoStatus(undefined)).toBe("PENDING");
    expect(mapMercadoPagoStatus(null)).toBe("PENDING");
  });
});