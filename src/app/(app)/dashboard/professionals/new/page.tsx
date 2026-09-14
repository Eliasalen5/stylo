import { requireCurrentBusiness } from "@/lib/current-business";
import { ProfessionalForm } from "@/components/professionals/professional-form";
import type { ProfessionalState } from "@/app/actions/professionals";

const initialState: ProfessionalState = {};

export default async function NewProfessionalPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireCurrentBusiness(await searchParams);

  return (
    <div className="w-full max-w-lg">
      <h1 className="text-2xl font-semibold">Nuevo profesional</h1>
      <ProfessionalForm state={initialState} submitLabel="Crear profesional" />
    </div>
  );
}
