import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireCurrentBusiness } from "@/lib/current-business";
import { ServiceForm } from "@/components/services/service-form";
import type { UpdateServiceState } from "@/app/actions/services";

export default async function EditServicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const business = await requireCurrentBusiness(sp);

  const service = await db.service.findFirst({
    where: { id, businessId: business.id },
  });

  if (!service) notFound();

  const initialState: UpdateServiceState = {};

  return (
    <div className="w-full max-w-lg">
      <h1 className="text-2xl font-semibold">Editar servicio</h1>
      <ServiceForm
        state={initialState}
        service={service}
        submitLabel="Guardar cambios"
      />
    </div>
  );
}
