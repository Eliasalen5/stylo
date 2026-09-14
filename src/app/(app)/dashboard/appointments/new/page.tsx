import { db } from "@/lib/db";
import { requireCurrentBusiness } from "@/lib/current-business";
import { NewAppointmentWizard } from "@/components/appointments/new-appointment-wizard";

export default async function NewAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const business = await requireCurrentBusiness(params);

  const [professionals, services, customers] = await Promise.all([
    db.professional.findMany({
      where: { businessId: business.id, isActive: true },
      include: {
        services: {
          select: { id: true, name: true, durationMinutes: true, price: true },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.service.findMany({
      where: { businessId: business.id, isActive: true },
      orderBy: { createdAt: "asc" },
    }),
    db.customer.findMany({
      where: { businessId: business.id },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="w-full max-w-2xl">
      <h1 className="text-2xl font-semibold">Nuevo turno</h1>
      <NewAppointmentWizard
        professionals={professionals}
        services={services}
        customers={customers}
      />
    </div>
  );
}
