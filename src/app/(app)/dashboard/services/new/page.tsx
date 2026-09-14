import { requireCurrentBusiness } from "@/lib/current-business";
import { ServiceForm } from "@/components/services/service-form";
import type { ServiceState } from "@/app/actions/services";

const initialState: ServiceState = {};

export default async function NewServicePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireCurrentBusiness(await searchParams);

  return (
    <div className="w-full max-w-lg">
      <h1 className="text-2xl font-semibold">Nuevo servicio</h1>
      <ServiceForm state={initialState} submitLabel="Crear servicio" />
    </div>
  );
}
