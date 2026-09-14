import Link from "next/link";
import { db } from "@/lib/db";
import { requireCurrentBusiness } from "@/lib/current-business";
import { AppointmentCard } from "@/components/appointments/appointment-card";

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const business = await requireCurrentBusiness(params);

  const dateParam = typeof params.date === "string" ? params.date : null;
  const professionalParam = typeof params.professional === "string" ? params.professional : null;
  const statusParam = typeof params.status === "string" ? params.status : null;

  const today = new Date();
  const todayStr = dateParam ?? today.toISOString().split("T")[0];
  const [year, month, day] = todayStr.split("-").map(Number);
  const dayStart = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const dayEnd = new Date(Date.UTC(year, month - 1, day, 23, 59, 59));

  const where: import("@/generated/prisma/client").Prisma.AppointmentWhereInput = {
    businessId: business.id,
    startsAt: { gte: dayStart, lte: dayEnd },
  };

  if (professionalParam) {
    where.professionalId = professionalParam;
  }

  if (statusParam && ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"].includes(statusParam)) {
    where.status = statusParam as "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
  }

  const [appointments, professionals] = await Promise.all([
    db.appointment.findMany({
      where,
      include: {
        professional: { select: { id: true, name: true } },
        service: { select: { id: true, name: true, durationMinutes: true } },
        customer: { select: { id: true, name: true, email: true, phone: true } },
      },
      orderBy: { startsAt: "asc" },
    }),
    db.professional.findMany({
      where: { businessId: business.id, isActive: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <div className="w-full max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Turnos</h1>
        <Link
          href="/dashboard/appointments/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Nuevo turno
        </Link>
      </div>

      <form className="mt-4 flex flex-wrap gap-3" method="get">
        <fieldset>
          <label htmlFor="date" className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">
            Fecha
          </label>
          <input
            id="date"
            name="date"
            type="date"
            defaultValue={todayStr}
            className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </fieldset>
        <fieldset>
          <label htmlFor="professional" className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">
            Profesional
          </label>
          <select
            id="professional"
            name="professional"
            defaultValue={professionalParam ?? ""}
            className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">Todos</option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </fieldset>
        <fieldset>
          <label htmlFor="status" className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">
            Estado
          </label>
          <select
            id="status"
            name="status"
            defaultValue={statusParam ?? ""}
            className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">Todos</option>
            <option value="PENDING">Pendiente</option>
            <option value="CONFIRMED">Confirmado</option>
            <option value="COMPLETED">Completado</option>
            <option value="CANCELLED">Cancelado</option>
            <option value="NO_SHOW">No asistio</option>
          </select>
        </fieldset>
        <div className="flex items-end">
          <button
            type="submit"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Filtrar
          </button>
        </div>
      </form>

      {appointments.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          No hay turnos para esta fecha.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {appointments.map((appt) => (
            <AppointmentCard
              key={appt.id}
              appointment={appt}
              timezone={business.timezone}
            />
          ))}
        </div>
      )}
    </div>
  );
}
