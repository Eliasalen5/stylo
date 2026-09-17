import { describe, it, expect } from "vitest";
import {
  validatePromotion,
  isPromotionVisible,
  describePromotionDiscount,
  type PromotionValidationInput,
} from "@/lib/promotions";

function validInput(overrides: Partial<PromotionValidationInput> = {}): PromotionValidationInput {
  return {
    name: "Semana del cliente",
    description: null,
    discountType: "PERCENTAGE",
    discountValue: 10,
    startsAt: null,
    endsAt: null,
    ...overrides,
  };
}

describe("validatePromotion", () => {
  it("acepta una promo de porcentaje válida", () => {
    const result = validatePromotion(validInput());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe("Semana del cliente");
      expect(result.value.discountType).toBe("PERCENTAGE");
      expect(result.value.discountValue).toBe(10);
    }
  });

  it("acepta una promo de monto fijo válida", () => {
    const result = validatePromotion(validInput({ discountType: "FIXED_AMOUNT", discountValue: 1500 }));
    expect(result.ok).toBe(true);
  });

  it("requiere nombre", () => {
    const result = validatePromotion(validInput({ name: "  " }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.name).toBeTruthy();
  });

  it("valida longitud del nombre", () => {
    const result = validatePromotion(validInput({ name: "x".repeat(121) }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.name).toBeTruthy();
  });

  it("rechaza descuento inválido (cero, negativo, no entero)", () => {
    for (const value of [0, -5, 2.5]) {
      const result = validatePromotion(validInput({ discountValue: value }));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.fieldErrors.discountValue).toBeTruthy();
    }
  });

  it("rechaza porcentaje mayor a 100", () => {
    const result = validatePromotion(validInput({ discountValue: 101 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.discountValue).toBeTruthy();
  });

  it("rechaza tipo de descuento desconocido", () => {
    const result = validatePromotion(validInput({ discountType: "OTHER" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.discountType).toBeTruthy();
  });

  it("rechaza fecha de fin anterior a la de inicio", () => {
    const result = validatePromotion(
      validInput({ startsAt: new Date("2026-09-10"), endsAt: new Date("2026-09-01") })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.endsAt).toBeTruthy();
  });

  it("valida longitud de la descripción", () => {
    const result = validatePromotion(validInput({ description: "x".repeat(501) }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.description).toBeTruthy();
  });
});

describe("isPromotionVisible", () => {
  const now = new Date("2026-09-17T12:00:00Z");

  it("esconde promociones inactivas", () => {
    expect(isPromotionVisible({ isActive: false, startsAt: null, endsAt: null }, now)).toBe(false);
  });

  it("muestra promoción sin fechas", () => {
    expect(isPromotionVisible({ isActive: true, startsAt: null, endsAt: null }, now)).toBe(true);
  });

  it("esconde antes de la fecha de inicio", () => {
    const p = { isActive: true, startsAt: new Date("2026-09-18T00:00:00Z"), endsAt: null };
    expect(isPromotionVisible(p, now)).toBe(false);
  });

  it("esconde después de la fecha de fin (inclusiva)", () => {
    const p = { isActive: true, startsAt: null, endsAt: new Date("2026-09-17T23:59:00Z") };
    expect(isPromotionVisible(p, now)).toBe(true);
    const expired = { isActive: true, startsAt: null, endsAt: new Date("2026-09-16T23:59:00Z") };
    expect(isPromotionVisible(expired, now)).toBe(false);
  });

  it("muestra promo dentro de la ventana", () => {
    const p = {
      isActive: true,
      startsAt: new Date("2026-09-01T00:00:00Z"),
      endsAt: new Date("2026-09-30T23:59:00Z"),
    };
    expect(isPromotionVisible(p, now)).toBe(true);
  });
});

describe("describePromotionDiscount", () => {
  it("formatea porcentaje", () => {
    expect(describePromotionDiscount("PERCENTAGE", 10)).toBe("10% de descuento");
  });

  it("formatea monto en pesos", () => {
    expect(describePromotionDiscount("FIXED_AMOUNT", 1500)).toBe("$1.500 de descuento");
  });
});