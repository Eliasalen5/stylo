"use client";

import { useActionState } from "react";
import { togglePlanActive } from "@/app/actions/plans";

type Props = {
  planId: string;
  isActive: boolean;
};

export function TogglePlanButton({ planId, isActive }: Props) {
  const [, formAction, isPending] = useActionState(
    togglePlanActive.bind(null, planId, !isActive),
    null
  );

  return (
    <form action={formAction}>
      <button
        type="submit"
        disabled={isPending}
        className={`rounded-md border px-3 py-1.5 text-sm disabled:opacity-60 ${
          isActive
            ? "border-red-300 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
            : "border-green-300 text-green-600 hover:bg-green-50 dark:border-green-900 dark:text-green-400 dark:hover:bg-green-950"
        }`}
      >
        {isPending ? "..." : isActive ? "Desactivar" : "Activar"}
      </button>
    </form>
  );
}