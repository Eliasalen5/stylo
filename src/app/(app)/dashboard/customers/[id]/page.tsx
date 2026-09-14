import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireCurrentBusiness } from "@/lib/current-business";
import { toTimezoneComponents } from "@/lib/datetime";
import { AppointmentCard } from "@/components/appointments/appointment-card";

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const business = await requireCurrentBusiness(query);

  // Scoped al tenant: un cliente de otro negocio no es accesible aunque se conozca su ID.
  const customer = await db.customer.findFirst({
    where: { id, businessId: business.id },
    include: {
      appointments: {
        include: {
          professional: { select: { id: true, name: true } },
          service: { select: { id: true, name: true, durationMinutes: true } },
          customer: { select: { id: true, name: true, email: true, phone: true } },
        },
        orderBy: { startsAt: "desc" },
      },
    },
  });

  if (!customer) notFound();

  const memberSince = toTimezoneComponents(customer.createdAt, business.timezone).dateStr;
  const upcoming = customer.appointments.filter((a) => a.endsAt > new Date());
  const history = customer.appointments.filter((a) => a.endsAt <= new Date());

  return (
    <div className="w-full max-w-3xl">
      <Link
        href="/dashboard/customers"
        className="text-sm text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← Clientes
      </Link>

      <div className="mt-2 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{customer.name}</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {[customer.email, customer.phone].filter(Boolean).join(" · ") ||
              "Sin contacto"}
          </p>
          {customer.notes && (
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {customer.notes}
            </p>
          )}
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            Cliente desde {memberSince}
          </p>
        </div>
        <Link
          href="/dashboard/appointments/new"
          className="shrink-0 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Nuevo turno
        </Link>
      </div>

      {upcoming.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-medium">Próximos turnos</h2>
          <div className="mt-3 space-y-3">
            {upcoming.map((appt) => (
              <AppointmentCard
                key={appt.id}
                appointment={appt}
                timezone={business.timezone}
              />
            ))}
          </div>
        </section>
      )}

      {history.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-medium">Historial</h2>
          <div className="mt-3 space-y-3">
            {history.map((appt) => (
              <AppointmentCard
                key={appt.id}
                appointment={appt}
                timezone={business.timezone}
              />
            ))}
          </div>
        </section>
      )}

      {customer.appointments.length === 0 && (
        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          Este cliente todavía no tiene turnos.
        </p>
      )}
    </div>
  );
}