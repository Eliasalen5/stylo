import { formatPrice } from "@/lib/format";

export const PROMOTION_DISCOUNT_TYPES = ["PERCENTAGE", "FIXED_AMOUNT"] as const;
export type PromotionDiscountType = (typeof PROMOTION_DISCOUNT_TYPES)[number];

export type PromotionFieldErrors = {
  name?: string;
  description?: string;
  discountType?: string;
  discountValue?: string;
  endsAt?: string;
};

export type PromotionValidationInput = {
  name: string;
  description: string | null;
  discountType: string;
  discountValue: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
};

export type PromotionValidationValue = {
  name: string;
  description: string | null;
  discountType: PromotionDiscountType;
  discountValue: number;
  startsAt: Date | null;
  endsAt: Date | null;
};

export type PromotionValidationResult =
  | { ok: true; value: PromotionValidationValue }
  | { ok: false; fieldErrors: PromotionFieldErrors };

// Cota de seguridad para montos fijos (pesos) y para el % (100).
const MAX_FIXED_AMOUNT = 10_000_000;

/**
 * Valida los datos de una promoción (server-side, nunca confiar en el cliente).
 * Solo valida y normaliza; no toca la base de datos.
 */
export function validatePromotion(
  input: PromotionValidationInput
): PromotionValidationResult {
  const fieldErrors: PromotionFieldErrors = {};

  const name = input.name.trim();
  if (!name) {
    fieldErrors.name = "El nombre es obligatorio.";
  } else if (name.length > 120) {
    fieldErrors.name = "El nombre no puede superar los 120 caracteres.";
  }

  const description = input.description?.trim() || null;
  if (description && description.length > 500) {
    fieldErrors.description = "La descripción no puede superar los 500 caracteres.";
  }

  const discountType = input.discountType as PromotionDiscountType;
  if (!PROMOTION_DISCOUNT_TYPES.includes(discountType)) {
    fieldErrors.discountType = "Tipo de descuento inválido.";
  }

  const discountValue = input.discountValue;
  if (discountValue === null) {
    fieldErrors.discountValue = "El descuento es obligatorio.";
  } else if (!Number.isInteger(discountValue) || discountValue <= 0) {
    fieldErrors.discountValue = "El descuento debe ser un número entero mayor a cero.";
  } else if (discountType === "PERCENTAGE" && discountValue > 100) {
    fieldErrors.discountValue = "El porcentaje no puede superar 100.";
  } else if (discountType === "FIXED_AMOUNT" && discountValue > MAX_FIXED_AMOUNT) {
    fieldErrors.discountValue = "El monto es demasiado alto.";
  }

  const { startsAt, endsAt } = input;
  if (startsAt && endsAt && endsAt < startsAt) {
    fieldErrors.endsAt = "La fecha de fin debe ser posterior a la de inicio.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    value: {
      name,
      description,
      discountType,
      discountValue: discountValue as number,
      startsAt,
      endsAt,
    },
  };
}

export type PromotionLike = {
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
};

/**
 * Indica si una promoción debe mostrarse en un instante dado:
 * activa y dentro de su ventana de validez (si no tiene fechas, siempre).
 */
export function isPromotionVisible(promotion: PromotionLike, now: Date): boolean {
  if (!promotion.isActive) return false;
  if (promotion.startsAt && promotion.startsAt > now) return false;
  if (promotion.endsAt && promotion.endsAt < now) return false;
  return true;
}

/**
 * Texto descriptivo del descuento. Ej: "10% de descuento" o "$1.500 de descuento".
 */
export function describePromotionDiscount(
  type: PromotionDiscountType,
  value: number
): string {
  return type === "PERCENTAGE"
    ? `${value}% de descuento`
    : `${formatPrice(value)} de descuento`;
}