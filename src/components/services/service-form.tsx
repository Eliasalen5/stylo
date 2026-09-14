"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import {
  createService,
  updateService,
  type ServiceState,
  type UpdateServiceState,
} from "@/app/actions/services";

type Props = {
  state: ServiceState | UpdateServiceState;
  service?: {
    id: string;
    name: string;
    description: string | null;
    durationMinutes: number;
    price: number;
  };
  submitLabel: string;
};

export function ServiceForm({ state, service, submitLabel }: Props) {
  const router = useRouter();

  const action = service
    ? updateService.bind(null, service.id)
    : createService;

  const [currentState, formAction, isPending] = useActionState(
    action as typeof createService,
    state
  );

  const errors = "fieldErrors" in currentState ? currentState.fieldErrors : undefined;
  const generalError = "error" in currentState ? currentState.error : undefined;

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
          defaultValue={service?.name ?? ""}
          placeholder="Ej: Corte de cabello"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
        {errors?.name && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.name}</p>
        )}
      </fieldset>

      <fieldset>
        <label htmlFor="durationMinutes" className="mb-1 block text-sm font-medium">
          Duración (minutos)
        </label>
        <input
          id="durationMinutes"
          name="durationMinutes"
          type="number"
          required
          min={5}
          max={480}
          defaultValue={service?.durationMinutes ?? ""}
          placeholder="Ej: 30"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
        {errors?.durationMinutes && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">
            {errors.durationMinutes}
          </p>
        )}
      </fieldset>

      <fieldset>
        <label htmlFor="price" className="mb-1 block text-sm font-medium">
          Precio
        </label>
        <input
          id="price"
          name="price"
          type="number"
          required
          min={0}
          defaultValue={service?.price ?? ""}
          placeholder="Ej: 3000"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
        {errors?.price && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">
            {errors.price}
          </p>
        )}
      </fieldset>

      <fieldset>
        <label htmlFor="description" className="mb-1 block text-sm font-medium">
          Descripción (opcional)
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={service?.description ?? ""}
          placeholder="Descripción del servicio..."
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
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
