import Link from "next/link";
import { db } from "@/lib/db";
import { requireCurrentBusiness } from "@/lib/current-business";
import { DeleteProfessionalButton } from "@/components/professionals/delete-professional-button";

export default async function ProfessionalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const business = await requireCurrentBusiness(params);

  const professionals = await db.professional.findMany({
    where: { businessId: business.id },
    include: { services: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="w-full max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Profesionales</h1>
        <Link
          href="/dashboard/professionals/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Nuevo profesional
        </Link>
      </div>

      {professionals.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          No tenés profesionales cargados. Agregá al primero para empezar a asignar turnos.
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {professionals.map((pro) => (
            <div
              key={pro.id}
              className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div className="min-w-0 flex-1">
                <h3 className="font-medium">{pro.name}</h3>
                <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                  {pro.email ?? "Sin email"}
                  {pro.phone ? ` · ${pro.phone}` : ""}
                </p>
                {pro.services.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {pro.services.map((s) => (
                      <span
                        key={s.id}
                        className="inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                      >
                        {s.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="ml-4 flex items-center gap-2">
                <Link
                  href={`/dashboard/professionals/${pro.id}`}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  Editar
                </Link>
                <DeleteProfessionalButton professionalId={pro.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
