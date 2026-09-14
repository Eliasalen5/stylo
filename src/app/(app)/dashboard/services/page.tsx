import Link from "next/link";
import { db } from "@/lib/db";
import { requireCurrentBusiness } from "@/lib/current-business";
import { formatPrice } from "@/lib/format";
import { DeleteServiceButton } from "@/components/services/delete-service-button";

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const business = await requireCurrentBusiness(params);

  const services = await db.service.findMany({
    where: { businessId: business.id },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="w-full max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Servicios</h1>
        <Link
          href="/dashboard/services/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Nuevo servicio
        </Link>
      </div>

      {services.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          No tenés servicios cargados. Creá el primero para que tus clientes puedan reservar.
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {services.map((service) => (
            <div
              key={service.id}
              className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div className="min-w-0 flex-1">
                <h3 className="font-medium">{service.name}</h3>
                <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                  {service.durationMinutes} min · {formatPrice(service.price)}
                </p>
                {service.description && (
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    {service.description}
                  </p>
                )}
              </div>
              <div className="ml-4 flex items-center gap-2">
                <Link
                  href={`/dashboard/services/${service.id}`}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  Editar
                </Link>
                <DeleteServiceButton serviceId={service.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
