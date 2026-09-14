import { StatusBadge } from "./status-badge";
import { AppointmentActions } from "./appointment-actions";
import { RescheduleAppointment } from "./reschedule-appointment";
import { toTimezoneComponents } from "@/lib/datetime";

type AppointmentWithRelations = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  status: string;
  price: number;
  notes: string | null;
  professional: { id: string; name: string };
  service: { id: string; name: string; durationMinutes: number };
  customer: { id: string; name: string; email: string | null; phone: string | null };
};

export function AppointmentCard({
  appointment,
  timezone,
}: {
  appointment: AppointmentWithRelations;
  timezone: string;
}) {
  const start = toTimezoneComponents(appointment.startsAt, timezone);
  const end = toTimezoneComponents(appointment.endsAt, timezone);

  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">
              {start.timeStr} - {end.timeStr}
            </span>
            <StatusBadge status={appointment.status} />
          </div>
          <p className="mt-1 text-sm">
            <span className="font-medium">{appointment.customer.name}</span>
            {appointment.customer.email && (
              <span className="text-zinc-500 dark:text-zinc-400">
                {" "} - {appointment.customer.email}
              </span>
            )}
          </p>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            {appointment.service.name} ({appointment.service.durationMinutes} min) con {appointment.professional.name}
          </p>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            ${appointment.price.toLocaleString("es-AR")}
          </p>
        </div>
        <AppointmentActions
          appointmentId={appointment.id}
          status={appointment.status}
        />
        <RescheduleAppointment
          appointmentId={appointment.id}
          professionalId={appointment.professional.id}
          serviceId={appointment.service.id}
          status={appointment.status}
        />
      </div>
    </div>
  );
}
