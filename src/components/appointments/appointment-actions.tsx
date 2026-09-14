"use client";

import { useActionState } from "react";
import { updateAppointmentStatus } from "@/app/actions/appointments";

type Props = {
  appointmentId: string;
  status: string;
};

export function AppointmentActions({ appointmentId, status }: Props) {
  const nextStatus =
    status === "PENDING"
      ? "CONFIRMED"
      : status === "CONFIRMED"
        ? "COMPLETED"
        : null;

  const cancelStatus = status === "PENDING" || status === "CONFIRMED"
    ? "CANCELLED"
    : null;

  if (!nextStatus && !cancelStatus) return null;

  return (
    <div className="ml-3 flex items-center gap-1">
      {nextStatus && (
        <StatusButton
          appointmentId={appointmentId}
          targetStatus={nextStatus}
          label={
            nextStatus === "CONFIRMED" ? "Confirmar" : "Completar"
          }
        />
      )}
      {cancelStatus && (
        <StatusButton
          appointmentId={appointmentId}
          targetStatus={cancelStatus}
          label="Cancelar"
          variant="danger"
        />
      )}
    </div>
  );
}

function StatusButton({
  appointmentId,
  targetStatus,
  label,
  variant = "default",
}: {
  appointmentId: string;
  targetStatus: string;
  label: string;
  variant?: "default" | "danger";
}) {
  const [state, formAction, isPending] = useActionState(
    async (_prev: { error?: string }, _form: FormData) => {
      return updateAppointmentStatus(
        appointmentId,
        targetStatus as "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW"
      );
    },
    {}
  );

  const baseClasses =
    "rounded-md px-2.5 py-1 text-xs font-medium disabled:opacity-60";
  const variantClasses =
    variant === "danger"
      ? "border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
      : "border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800";

  return (
    <form action={formAction}>
      <button
        type="submit"
        disabled={isPending}
        onClick={(e) => {
          if (!confirm(`¿${label} turno?`)) {
            e.preventDefault();
          }
        }}
        className={`${baseClasses} ${variantClasses}`}
      >
        {isPending ? "..." : label}
      </button>
      {state.error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}
