import { db } from "@/lib/db";
import { requireCurrentBusiness } from "@/lib/current-business";
import { getEffectivePlan } from "@/lib/plan-limits";
import {
  SubscribeButton,
  CancelSubscriptionButton,
} from "@/components/billing/billing-actions";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente de pago",
  ACTIVE: "Activa",
  PAST_DUE: "Con pago vencido",
  CANCELLED: "Cancelada",
  EXPIRED: "Expirada",
};

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const business = await requireCurrentBusiness(params);

  const [plans, subscription, effectivePlan] = await Promise.all([
    db.plan.findMany({
      where: { isActive: true },
      orderBy: { price: "asc" },
    }),
    db.subscription.findFirst({
      where: { businessId: business.id },
      orderBy: { createdAt: "desc" },
      include: { plan: true },
    }),
    getEffectivePlan(business.id),
  ]);

  const activeSubscription =
    subscription && ["ACTIVE", "PAST_DUE", "PENDING"].includes(subscription.status)
      ? subscription
      : null;

  return (
    <div className="w-full max-w-3xl space-y-8">
      <section>
        <h1 className="text-2xl font-semibold">Suscripción</h1>

        {activeSubscription ? (
          <div className="mt-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">{activeSubscription.plan.name}</p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Estado: {STATUS_LABELS[activeSubscription.status] ?? activeSubscription.status}
                </p>
                <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                  Período actual: {formatDate(activeSubscription.currentPeriodStart)} →{" "}
                  {formatDate(activeSubscription.currentPeriodEnd)}
                </p>
              </div>
              {activeSubscription.status === "ACTIVE" && (
                <CancelSubscriptionButton />
              )}
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            Este negocio no tiene una suscripción activa. Elegí un plan para empezar a cobrar la
            mensualidad por Mercado Pago.
          </p>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">Planes disponibles</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {plans.map((plan) => {
            const isCurrent =
              activeSubscription?.planId === plan.id && effectivePlan?.id === plan.id;
            return (
              <div
                key={plan.id}
                className="flex flex-col rounded-lg border border-zinc-200 p-5 dark:border-zinc-800"
              >
                <h3 className="font-medium">{plan.name}</h3>
                {plan.description && (
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    {plan.description}
                  </p>
                )}
                <p className="mt-3 text-2xl font-semibold">
                  ARS {plan.price.toLocaleString("es-AR")}
                  <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400">
                    {plan.intervalCount > 1 ? ` / ${plan.intervalCount} ${plan.interval.toLowerCase()}es` : ` / ${plan.interval.toLowerCase()}`}
                  </span>
                </p>
                <div className="mt-4 flex-1" />
                <SubscribeButton
                  planId={plan.id}
                  disabled={Boolean(isCurrent || activeSubscription)}
                />
                {isCurrent && (
                  <p className="mt-2 text-center text-xs text-green-600 dark:text-green-400">
                    Plan actual
                  </p>
                )}
              </div>
            );
          })}
        </div>
        {plans.length === 0 && (
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            Todavía no hay planes publicados por la plataforma.
          </p>
        )}
      </section>
    </div>
  );
}