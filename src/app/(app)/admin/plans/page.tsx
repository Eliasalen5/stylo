import Link from "next/link";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { TogglePlanButton } from "@/components/admin/toggle-plan-button";

export default async function AdminPlansPage() {
  await requirePlatformAdmin();

  const plans = await db.plan.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { subscriptions: true } } },
  });

  return (
    <div className="w-full max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Planes de suscripción</h1>
        <Link
          href="/admin/plans/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Nuevo plan
        </Link>
      </div>

      {plans.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          No hay planes creados. Creá el primero para que los negocios puedan suscribirse.
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">{plan.name}</h3>
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                      plan.isActive
                        ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                        : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    {plan.isActive ? "Activo" : "Inactivo"}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                  ARS {plan.price} / {plan.interval.toLowerCase()}
                  {plan.intervalCount > 1 ? ` x${plan.intervalCount}` : ""}
                  {plan.description ? ` · ${plan.description}` : ""}
                </p>
                <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
                  {plan._count.subscriptions} suscripciones
                  {plan.mercadoPagoPlanId ? " · vinculado a Mercado Pago" : ""}
                </p>
              </div>
              <div className="ml-4 flex items-center gap-2">
                <Link
                  href={`/admin/plans/${plan.id}`}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  Editar
                </Link>
                <TogglePlanButton planId={plan.id} isActive={plan.isActive} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}