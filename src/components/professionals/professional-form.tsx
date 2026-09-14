"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import {
  createProfessional,
  updateProfessional,
  type ProfessionalState,
  type UpdateProfessionalState,
} from "@/app/actions/professionals";

type Props = {
  state: ProfessionalState | UpdateProfessionalState;
  professional?: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  };
  submitLabel: string;
};

export function ProfessionalForm({ state, professional, submitLabel }: Props) {
  const router = useRouter();

  const action = professional
    ? updateProfessional.bind(null, professional.id)
    : createProfessional;

  const [currentState, formAction, isPending] = useActionState(
    action as typeof createProfessional,
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
          defaultValue={professional?.name ?? ""}
          placeholder="Ej: Juan Pérez"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
        {errors?.name && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.name}</p>
        )}
      </fieldset>

      <fieldset>
        <label htmlFor="email" className="mb-1 block text-sm font-medium">
          Email (opcional)
        </label>
        <input
          id="email"
          name="email"
          type="email"
          defaultValue={professional?.email ?? ""}
          placeholder="juan@ejemplo.com"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
        {errors?.email && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.email}</p>
        )}
      </fieldset>

      <fieldset>
        <label htmlFor="phone" className="mb-1 block text-sm font-medium">
          Teléfono (opcional)
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          defaultValue={professional?.phone ?? ""}
          placeholder="+54 11 5555 5555"
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
