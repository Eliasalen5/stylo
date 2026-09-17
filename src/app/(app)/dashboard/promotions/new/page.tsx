import { requireCurrentBusiness } from "@/lib/current-business";
import { PromotionForm } from "@/components/promotions/promotion-form";
import type { PromotionState } from "@/app/actions/promotions";

const initialState: PromotionState = {};

export default async function NewPromotionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireCurrentBusiness(await searchParams);

  return (
    <div className="w-full max-w-xl">
      <h1 className="text-2xl font-semibold">Nueva promoción</h1>
      <PromotionForm state={initialState} submitLabel="Crear promoción" />
    </div>
  );
}