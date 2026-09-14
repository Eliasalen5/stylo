import Link from "next/link";
import { db } from "@/lib/db";
import { requireCurrentBusiness } from "@/lib/current-business";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const business = await requireCurrentBusiness(params);

  const customers = await db.customer.findMany({
    where: { businessId: business.id },
    include: {
      _count: { select: { appointments: true } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="w-full max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Clientes</h1>
        <Link
          href="/dashboard/appointments/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Nuevo turno
        </Link>
      </div>

      {customers.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          Todavía no tenés clientes. Se crean automáticamente cuando reservan en tu página.
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {customers.map((customer) => (
            <div
              key={customer.id}
              className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div className="min-w-0 flex-1">
                <h3 className="font-medium">{customer.name}</h3>
                <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                  {[customer.email, customer.phone].filter(Boolean).join(" · ") ||
                    "Sin contacto"}
                </p>
              </div>
              <div className="ml-4 flex items-center gap-2">
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  {customer._count.appointments}{" "}
                  {customer._count.appointments === 1 ? "turno" : "turnos"}
                </span>
                <Link
                  href={`/dashboard/customers/${customer.id}`}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  Ver
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}