"use client";

import { useActionState } from "react";
import { deleteService } from "@/app/actions/services";

export function DeleteServiceButton({ serviceId }: { serviceId: string }) {
  const [state, formAction, isPending] = useActionState(
    async (_prev: { error?: string }, _form: FormData) => {
      return deleteService(serviceId);
    },
    {}
  );

  return (
    <form action={formAction}>
      <button
        type="submit"
        disabled={isPending}
        onClick={(e) => {
          if (!confirm("¿Eliminar este servicio?")) {
            e.preventDefault();
          }
        }}
        className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
      >
        {isPending ? "..." : "Eliminar"}
      </button>
      {state.error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{state.error}</p>
      )}
    </form>
  );
}
