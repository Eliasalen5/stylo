import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireCurrentBusiness } from "@/lib/current-business";
import { ProfessionalForm } from "@/components/professionals/professional-form";
import { ServiceAssignment } from "@/components/professionals/service-assignment";
import type { UpdateProfessionalState } from "@/app/actions/professionals";

export default async function EditProfessionalPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const business = await requireCurrentBusiness(sp);

  const professional = await db.professional.findFirst({
    where: { id, businessId: business.id },
    include: { services: { select: { id: true } } },
  });

  if (!professional) notFound();

  const allServices = await db.service.findMany({
    where: { businessId: business.id },
    orderBy: { createdAt: "asc" },
  });

  const assignedServiceIds = professional.services.map((s) => s.id);
  const initialState: UpdateProfessionalState = {};

  return (
    <div className="w-full max-w-lg">
      <h1 className="text-2xl font-semibold">Editar profesional</h1>
      <ProfessionalForm
        state={initialState}
        professional={professional}
        submitLabel="Guardar cambios"
      />
      <div className="mt-8 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <ServiceAssignment
          professionalId={professional.id}
          allServices={allServices}
          assignedServiceIds={assignedServiceIds}
        />
      </div>
    </div>
  );
}
