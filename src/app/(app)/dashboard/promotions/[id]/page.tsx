import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireCurrentBusiness } from "@/lib/current-business";
import { toTimezoneComponents } from "@/lib/datetime";
import { PromotionForm } from "@/components/promotions/promotion-form";
import type { PromotionState } from "@/app/actions/promotions";

export default async function EditPromotionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const business = await requireCurrentBusiness(sp);

  const promotion = await db.promotion.findFirst({
    where: { id, businessId: business.id },
  });

  if (!promotion) notFound();

  const initialState: PromotionState = {};

  return (
    <div className="w-full max-w-xl">
      <h1 className="text-2xl font-semibold">Editar promoción</h1>
      <PromotionForm
        state={initialState}
        promotion={{
          id: promotion.id,
          name: promotion.name,
          description: promotion.description,
          discountType: promotion.discountType,
          discountValue: promotion.discountValue,
          startsAtDate: promotion.startsAt
            ? toTimezoneComponents(promotion.startsAt, business.timezone).dateStr
            : "",
          endsAtDate: promotion.endsAt
            ? toTimezoneComponents(promotion.endsAt, business.timezone).dateStr
            : "",
        }}
        submitLabel="Guardar cambios"
      />
    </div>
  );
}