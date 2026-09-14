"use client";

import { useActionState } from "react";
import { deleteBusinessHours } from "@/app/actions/hours";

export function DeleteHoursButton({ hoursId }: { hoursId: string }) {
  const [state, formAction, isPending] = useActionState(
    async (_prev: { error?: string }, _form: FormData) => {
      return deleteBusinessHours(hoursId);
    },
    {}
  );

  return (
    <form action={formAction}>
      <button
        type="submit"
        disabled={isPending}
        onClick={(e) => {
          if (!confirm("¿Eliminar este horario?")) {
            e.preventDefault();
          }
        }}
        className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-60 dark:text-red-400 dark:hover:bg-red-950"
      >
        {isPending ? "..." : "Eliminar"}
      </button>
      {state.error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{state.error}</p>
      )}
    </form>
  );
}
