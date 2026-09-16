"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import {
  cancelAppointmentByTokenAction,
  rescheduleAppointmentByTokenAction,
} from "@/app/actions/appointment-self-service";
import { StatusBadge } from "@/components/appointments/status-badge";
import { toTimezoneComponents } from "@/lib/datetime";
import { formatPrice } from "@/lib/format";

type Slot = {
  startTime: string;
  endTime: string;
  startsAtUTC: string;
};

type AppointmentData = {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string;
  price: number;
  customer: { name: string };
  service: { id: string; name: string; durationMinutes: number };
  professional: { id: string; name: string };
  business: { name: string; slug: string; timezone: string };
};

export function AppointmentManage({
  appointment,
  token,
  nowIso,
}: {
  appointment: AppointmentData;
  token: string;
  nowIso: string;
}) {
  const {
    status,
    startsAt,
    endsAt,
    price,
    customer,
    service,
    professional,
    business,
  } = appointment;

  const [cancelState, cancelAction, cancelPending] = useActionState(
    cancelAppointmentByTokenAction,
    {}
  );
  const [rescheduleState, rescheduleAction, reschedulePending] = useActionState(
    rescheduleAppointmentByTokenAction,
    {}
  );

  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  useEffect(() => {
    if (!date) return;

    let cancelled = false;

    fetch(
      `/api/slots?professionalId=${appointment.professional.id}&serviceId=${appointment.service.id}&date=${date}`
    )
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setSlots(data.slots ?? []);
        setLoadingSlots(false);
      })
      .catch(() => {
        if (cancelled) return;
        setSlots([]);
        setLoadingSlots(false);
      });

    return () => {
      cancelled = true;
    };
  }, [date, appointment.professional.id, appointment.service.id]);

  const start = toTimezoneComponents(new Date(startsAt), business.timezone);
  const end = toTimezoneComponents(new Date(endsAt), business.timezone);
  const alreadyStarted = new Date(startsAt).getTime() <= new Date(nowIso).getTime();
  const manageable = (status === "PENDING" || status === "CONFIRMED") && !alreadyStarted;

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{service.name}</h2>
          <StatusBadge status={status} />
        </div>
        <dl className="mt-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-zinc-500 dark:text-zinc-400">Profesional</dt>
            <dd className="font-medium">{professional.name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-500 dark:text-zinc-400">Fecha y hora</dt>
            <dd className="font-medium">
              {start.dateStr} {start.timeStr} - {end.timeStr} hs
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-500 dark:text-zinc-400">Duración</dt>
            <dd className="font-medium">{service.durationMinutes} min</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-500 dark:text-zinc-400">Precio</dt>
            <dd className="font-medium">{formatPrice(price)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-500 dark:text-zinc-400">Cliente</dt>
            <dd className="font-medium">{customer.name}</dd>
          </div>
        </dl>
      </section>

      {status === "CANCELLED" && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-center dark:border-red-900 dark:bg-red-950">
          <h2 className="text-sm font-semibold text-red-800 dark:text-red-300">
            Este turno fue cancelado.
          </h2>
          <p className="mt-1 text-sm text-red-700 dark:text-red-400">
            Si querés, podés reservar otro horario.
          </p>
          <a
            href={`/${business.slug}`}
            className="mt-3 inline-block rounded-md bg-red-800 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Reservar otro turno
          </a>
        </div>
      )}

      {(status === "COMPLETED" || status === "NO_SHOW") && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Este turno ya no se puede modificar.
        </p>
      )}

      {status === "CONFIRMED" && alreadyStarted && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          El horario de este turno ya pasó.
        </p>
      )}

      {manageable && (
        <div className="space-y-6">
          {/* Cancelar */}
          <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-base font-semibold">Cancelar turno</h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              El negocio recibirá el aviso de cancelación.
            </p>
            {cancelState.error && (
              <p
                role="alert"
                className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
              >
                {cancelState.error}
              </p>
            )}
            <form action={cancelAction}>
              <input type="hidden" name="token" value={token} />
              <input type="hidden" name="slug" value={business.slug} />
              <button
                type="submit"
                disabled={cancelPending}
                className="mt-3 rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950"
              >
                {cancelPending ? "Cancelando..." : "Cancelar este turno"}
              </button>
            </form>
          </section>

          {/* Reprogramar */}
          <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-base font-semibold">Reprogramar</h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Elegí una nueva fecha y hora.
            </p>

            {rescheduleState.error && (
              <p
                role="alert"
                className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
              >
                {rescheduleState.error}
              </p>
            )}

            <form action={rescheduleAction}>
              <input type="hidden" name="token" value={token} />
              <input type="hidden" name="slug" value={business.slug} />
              <input type="hidden" name="startsAt" value={selectedSlot?.startsAtUTC ?? ""} />

              <fieldset className="mt-3">
                <label
                  htmlFor="manage-date"
                  className="mb-1 block text-sm font-medium"
                >
                  Nueva fecha
                </label>
                <input
                  id="manage-date"
                  type="date"
                  required
                  min={nowIso.split("T")[0]}
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setSelectedSlot(null);
                    setSlots([]);
                    setLoadingSlots(true);
                  }}
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </fieldset>

              {date && (
                <div className="mt-4">
                  {loadingSlots ? (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      Cargando horarios...
                    </p>
                  ) : slots.length === 0 ? (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      No hay horarios disponibles para esta fecha.
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                      {slots.map((slot) => (
                        <button
                          key={slot.startTime}
                          type="button"
                          onClick={() => setSelectedSlot(slot)}
                          className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                            selectedSlot?.startTime === slot.startTime
                              ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                              : "border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                          }`}
                        >
                          {slot.startTime}
                        </button>
                      ))}
                    </div>
                  )}

                  {rescheduleState.fieldErrors?.time && (
                    <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                      {rescheduleState.fieldErrors.time}
                    </p>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={!selectedSlot || reschedulePending}
                className="mt-4 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                {reschedulePending ? "Reprogramando..." : "Reprogramar turno"}
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}