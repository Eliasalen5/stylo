"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createPromotion,
  updatePromotion,
  type PromotionState,
} from "@/app/actions/promotions";
import { PROMOTION_DISCOUNT_TYPES } from "@/lib/promotions";

type Props = {
  state: PromotionState;
  promotion?: {
    id: string;
    name: string;
    description: string | null;
    discountType: string;
    discountValue: number;
    startsAtDate: string;
    endsAtDate: string;
  };
  submitLabel: string;
};

export function PromotionForm({ state, promotion, submitLabel }: Props) {
  const router = useRouter();
  const [discountType, setDiscountType] = useState(
    promotion?.discountType ?? "PERCENTAGE"
  );

  const action = promotion
    ? updatePromotion.bind(null, promotion.id)
    : createPromotion;

  const [currentState, formAction, isPending] = useActionState(
    action as typeof createPromotion,
    state
  );

  const errors = "fieldErrors" in currentState ? currentState.fieldErrors : undefined;
  const generalError = "error" in currentState ? currentState.error : undefined;

  const discountHelp =
    discountType === "PERCENTAGE"
      ? "Porcentaje a descontar (ej: 10 = 10%)."
      : "Monto fijo en pesos (ej: 1500 = $1.500).";

  return (
    <form action={formAction} className="mt-6 space-y-5">
      {generalError && (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
        >
          {generalError}
        </p>
      )}

      <fieldset>
        <label htmlFor="name" className="mb-1 block text-sm font-medium">
          Nombre
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          maxLength={120}
          defaultValue={promotion?.name ?? ""}
          placeholder="Ej: Semana del cliente"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
        {errors?.name && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.name}</p>
        )}
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <fieldset>
          <label htmlFor="discountType" className="mb-1 block text-sm font-medium">
            Tipo de descuento
          </label>
          <select
            id="discountType"
            name="discountType"
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value)}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          >
            {PROMOTION_DISCOUNT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type === "PERCENTAGE" ? "Porcentaje (%)" : "Monto fijo ($)"}
              </option>
            ))}
          </select>
          {errors?.discountType && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              {errors.discountType}
            </p>
          )}
        </fieldset>

        <fieldset>
          <label htmlFor="discountValue" className="mb-1 block text-sm font-medium">
            Descuento
          </label>
          <input
            id="discountValue"
            name="discountValue"
            type="number"
            required
            min={1}
            max={discountType === "PERCENTAGE" ? 100 : undefined}
            defaultValue={promotion?.discountValue ?? ""}
            placeholder={discountType === "PERCENTAGE" ? "Ej: 10" : "Ej: 1500"}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{discountHelp}</p>
          {errors?.discountValue && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              {errors.discountValue}
            </p>
          )}
        </fieldset>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <fieldset>
          <label htmlFor="startsAt" className="mb-1 block text-sm font-medium">
            Válida desde (opcional)
          </label>
          <input
            id="startsAt"
            name="startsAt"
            type="date"
            defaultValue={promotion?.startsAtDate ?? ""}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </fieldset>

        <fieldset>
          <label htmlFor="endsAt" className="mb-1 block text-sm font-medium">
            Válida hasta (opcional)
          </label>
          <input
            id="endsAt"
            name="endsAt"
            type="date"
            defaultValue={promotion?.endsAtDate ?? ""}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
          {errors?.endsAt && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              {errors.endsAt}
            </p>
          )}
        </fieldset>
      </div>

      <fieldset>
        <label htmlFor="description" className="mb-1 block text-sm font-medium">
          Descripción (opcional)
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          maxLength={500}
          defaultValue={promotion?.description ?? ""}
          placeholder="Detalles de la promoción..."
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
        {errors?.description && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">
            {errors.description}
          </p>
        )}
      </fieldset>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {isPending ? "Guardando..." : submitLabel}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-zinc-300 px-4 py-2.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}