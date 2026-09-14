import Link from "next/link";
import { db } from "@/lib/db";
import { requireCurrentBusiness } from "@/lib/current-business";
import { localToUTC, toTimezoneComponents, toMinutes } from "@/lib/datetime";
import { WEEKDAY_TO_INDEX } from "@/lib/availability";
import type { WeekDay } from "@/generated/prisma/client";
import { AppointmentsBoard } from "@/components/appointments/appointments-board";

function formatHH(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

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

  // El día por defecto es el día local del negocio (no el UTC del servidor).
  const selectedDate = dateParam ?? toTimezoneComponents(new Date(), business.timezone).dateStr;

  // La ventana del día se calcula en la timezone del negocio.
  const dayStartUTC = localToUTC(selectedDate, "00:00", business.timezone);
  const dayEndUTC = localToUTC(selectedDate, "24:00", business.timezone);

  const where: import("@/generated/prisma/client").Prisma.AppointmentWhereInput = {
    businessId: business.id,
    startsAt: { gte: dayStartUTC, lte: dayEndUTC },
  };

  if (professionalParam) {
    where.professionalId = professionalParam;
  }

  if (statusParam && ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"].includes(statusParam)) {
    where.status = statusParam as "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
  }

  // Día de la semana local de la fecha seleccionada (para el marco horario).
  const [y, m, d] = selectedDate.split("-").map(Number);
  const jsDay = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
  const weekday = Object.entries(WEEKDAY_TO_INDEX).find(([, i]) => i === jsDay)?.[0];

  const [appointments, professionals, businessHours] = await Promise.all([
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
    db.businessHours.findMany({
      where: {
        businessId: business.id,
        professionalId: null,
        dayOfWeek: weekday as WeekDay | undefined,
        isActive: true,
      },
    }),
  ]);

  // Marco de la agenda: horas de atención del negocio, ampliado para incluir
  // turnos que caen fuera del horario (ej. horas propias de un profesional).
  const planHours = businessHours.length > 0 ? businessHours : null;
  let openMin = planHours
    ? Math.min(...planHours.map((h) => toMinutes(h.startTime)))
    : 7 * 60;
  let closeMin = planHours
    ? Math.max(...planHours.map((h) => toMinutes(h.endTime)))
    : 22 * 60;

  for (const appt of appointments) {
    const start = toMinutes(
      toTimezoneComponents(appt.startsAt, business.timezone).timeStr
    );
    const end = toMinutes(
      toTimezoneComponents(appt.endsAt, business.timezone).timeStr
    );
    if (end > start) {
      openMin = Math.min(openMin, start);
      closeMin = Math.max(closeMin, end);
    }
  }

  openMin = Math.floor(openMin / 60) * 60;
  closeMin = Math.ceil(closeMin / 60) * 60;
  if (closeMin <= openMin) closeMin = openMin + 60;

  const hasContent = appointments.length > 0 || professionals.length > 0;

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
            defaultValue={selectedDate}
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

      {!hasContent ? (
        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          No hay turnos para esta fecha.
        </p>
      ) : (
        <AppointmentsBoard
          appointments={appointments}
          professionals={professionals.map((p) => ({ id: p.id, name: p.name }))}
          timezone={business.timezone}
          openTime={formatHH(openMin)}
          closeTime={formatHH(closeMin)}
        />
      )}
    </div>
  );
}