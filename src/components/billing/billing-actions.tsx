"use client";

import { useActionState } from "react";
import {
  subscribeToPlan,
  cancelSubscription,
  type SubscribeResult,
  type CancelSubscriptionState,
} from "@/app/actions/billing";

export function SubscribeButton({
  planId,
  disabled,
}: {
  planId: string;
  disabled?: boolean;
}) {
  const [state, formAction, isPending] = useActionState<SubscribeResult, FormData>(
    subscribeToPlan.bind(null, planId),
    {}
  );

  return (
    <form action={formAction}>
      {state.error && (
        <p className="mb-2 text-xs text-red-600 dark:text-red-400">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={disabled || isPending}
        className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {isPending ? "Iniciando..." : "Suscribirme"}
      </button>
    </form>
  );
}

export function CancelSubscriptionButton() {
  const [state, formAction, isPending] = useActionState<
    CancelSubscriptionState,
    FormData
  >(cancelSubscription, {});

  return (
    <form action={formAction}>
      {state.error && (
        <p className="mb-2 text-xs text-red-600 dark:text-red-400">{state.error}</p>
      )}
      {state.success && (
        <p className="mb-2 text-xs text-green-600 dark:text-green-400">
          Tu suscripción fue cancelada.
        </p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
      >
        {isPending ? "Cancelando..." : "Cancelar suscripción"}
      </button>
    </form>
  );
}