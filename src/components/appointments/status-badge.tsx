const STATUS_STYLES: Record<string, string> = {
  PENDING:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  CONFIRMED:
    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  COMPLETED:
    "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  CANCELLED:
    "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  NO_SHOW:
    "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmado",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
  NO_SHOW: "No asistio",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status] ?? STATUS_STYLES.PENDING}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
