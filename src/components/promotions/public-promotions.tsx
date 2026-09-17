import { formatDate } from "@/lib/format";
import {
  describePromotionDiscount,
  isPromotionVisible,
  type PromotionDiscountType,
} from "@/lib/promotions";

type PublicPromotion = {
  name: string;
  description: string | null;
  discountType: PromotionDiscountType;
  discountValue: number;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
};

/**
 * Muestra las promociones vigentes del negocio en su página pública.
 * La visibilidad se filtra en el servidor (fechas + actividad).
 */
export function PublicPromotions({
  promotions,
  timezone,
}: {
  promotions: PublicPromotion[];
  timezone: string;
}) {
  const now = new Date();
  const visible = promotions.filter((p) => isPromotionVisible(p, now));

  if (visible.length === 0) return null;

  return (
    <section className="mt-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Promociones
      </h2>
      <div className="mt-3 grid gap-3">
        {visible.map((promotion) => {
          const range =
            promotion.startsAt && promotion.endsAt
              ? ` del ${formatDate(promotion.startsAt, timezone)} al ${formatDate(
                  promotion.endsAt,
                  timezone
                )}`
              : promotion.startsAt
                ? ` desde el ${formatDate(promotion.startsAt, timezone)}`
                : promotion.endsAt
                  ? ` hasta el ${formatDate(promotion.endsAt, timezone)}`
                  : "";

          return (
            <div
              key={promotion.name}
              className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/40"
            >
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                {describePromotionDiscount(
                  promotion.discountType,
                  promotion.discountValue
                )}
              </p>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {promotion.name}
                {range && (
                  <span className="text-zinc-500 dark:text-zinc-400">{range}</span>
                )}
              </p>
              {promotion.description && (
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                  {promotion.description}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}