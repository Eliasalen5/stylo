"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import {
  createPlan,
  updatePlan,
  type PlanState,
} from "@/app/actions/plans";
import type { SubscriptionInterval } from "@/generated/prisma/client";

type PlanFormProps = {
  state: PlanState;
  plan?: {
    id: string;
    name: string;
    description: string | null;
    price: number;
    interval: SubscriptionInterval;
    intervalCount: number;
    limits: Record<string, number> | null;
  };
  submitLabel: string;
};

const INTERVAL_LABELS: Record<SubscriptionInterval, string> = {
  DAY: "Día",
  WEEK: "Semana",
  MONTH: "Mes",
  YEAR: "Año",
};

export function PlanForm({ state, plan, submitLabel }: PlanFormProps) {
  const router = useRouter();

  const action = plan ? updatePlan.bind(null, plan.id) : createPlan;
  const [currentState, formAction, isPending] = useActionState(
    action as typeof createPlan,
    state
  );

  const errors =
    "fieldErrors" in currentState ? currentState.fieldErrors : undefined;
  const generalError = "error" in currentState ? currentState.error : undefined;
  const success = "success" in currentState ? currentState.success : undefined;

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
      {success && (
        <p
          role="status"
          className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300"
        >
          Guardado.
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
          maxLength={80}
          defaultValue={plan?.name ?? ""}
          placeholder="Ej: Plan Pro"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
        {errors?.name && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.name}</p>
        )}
      </fieldset>

      <fieldset>
        <label htmlFor="description" className="mb-1 block text-sm font-medium">
          Descripción (opcional)
        </label>
        <textarea
          id="description"
          name="description"
          rows={2}
          defaultValue={plan?.description ?? ""}
          placeholder="Beneficios del plan para el negocio"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </fieldset>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <fieldset>
          <label htmlFor="price" className="mb-1 block text-sm font-medium">
            Precio mensual (ARS)
          </label>
          <input
            id="price"
            name="price"
            type="number"
            required
            min={0}
            step={1}
            defaultValue={plan?.price ?? ""}
            placeholder="5000"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
          {errors?.price && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.price}</p>
          )}
        </fieldset>

        <fieldset>
          <label htmlFor="interval" className="mb-1 block text-sm font-medium">
            Intervalo
          </label>
          <select
            id="interval"
            name="interval"
            defaultValue={plan?.interval ?? "MONTH"}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          >
            {Object.entries(INTERVAL_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {errors?.interval && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.interval}</p>
          )}
        </fieldset>

        <fieldset>
          <label htmlFor="intervalCount" className="mb-1 block text-sm font-medium">
            Cada cuántos
          </label>
          <input
            id="intervalCount"
            name="intervalCount"
            type="number"
            required
            min={1}
            max={12}
            step={1}
            defaultValue={plan?.intervalCount ?? 1}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </fieldset>
      </div>

      <fieldset>
        <label htmlFor="limits" className="mb-1 block text-sm font-medium">
          Límites (JSON, opcional)
        </label>
        <input
          id="limits"
          name="limits"
          type="text"
          defaultValue={plan?.limits ? JSON.stringify(plan.limits) : ""}
          placeholder='{"maxProfessionals": 3, "maxAppointmentsPerDay": 30}'
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
        {errors?.limits && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.limits}</p>
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