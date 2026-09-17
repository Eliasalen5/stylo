import Link from "next/link";
import { db } from "@/lib/db";
import { requireCurrentBusiness } from "@/lib/current-business";
import { formatDate } from "@/lib/format";
import {
  describePromotionDiscount,
  isPromotionVisible,
} from "@/lib/promotions";
import { DeletePromotionButton } from "@/components/promotions/delete-promotion-button";

export default async function PromotionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const business = await requireCurrentBusiness(params);
  const now = new Date();

  const promotions = await db.promotion.findMany({
    where: { businessId: business.id },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="w-full max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Promociones</h1>
        <Link
          href="/dashboard/promotions/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Nueva promoción
        </Link>
      </div>

      {promotions.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          No tenés promociones cargadas. Creá la primera para mostrarla en tu
          página pública.
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {promotions.map((promotion) => {
            const visible = isPromotionVisible(promotion, now);
            const range =
              promotion.startsAt && promotion.endsAt
                ? `del ${formatDate(promotion.startsAt, business.timezone)} al ${formatDate(
                    promotion.endsAt,
                    business.timezone
                  )}`
                : promotion.startsAt
                  ? `desde el ${formatDate(promotion.startsAt, business.timezone)}`
                  : promotion.endsAt
                    ? `hasta el ${formatDate(promotion.endsAt, business.timezone)}`
                    : "sin fecha límite";

            return (
              <div
                key={promotion.id}
                className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{promotion.name}</h3>
                    {visible ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                        Visible
                      </span>
                    ) : promotion.isActive ? (
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                        Fuera de vigencia
                      </span>
                    ) : (
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                        Inactiva
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                    {describePromotionDiscount(
                      promotion.discountType,
                      promotion.discountValue
                    )}{" "}
                    · {range}
                  </p>
                  {promotion.description && (
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      {promotion.description}
                    </p>
                  )}
                </div>
                <div className="ml-4 flex items-center gap-2">
                  <Link
                    href={`/dashboard/promotions/${promotion.id}`}
                    className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  >
                    Editar
                  </Link>
                  <DeletePromotionButton promotionId={promotion.id} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}