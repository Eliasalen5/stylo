"use client";

import { useState, useEffect } from "react";
import { useActionState } from "react";
import { rescheduleAppointment } from "@/app/actions/appointments";

type Slot = {
  startTime: string;
  endTime: string;
  startsAtUTC: string;
};

type Props = {
  appointmentId: string;
  professionalId: string;
  serviceId: string;
  status: string;
};

export function RescheduleAppointment({
  appointmentId,
  professionalId,
  serviceId,
  status,
}: Props) {
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [attempted, setAttempted] = useState(false);

  const [state, formAction, isPending] = useActionState(
    rescheduleAppointment.bind(null, appointmentId),
    {}
  );

  const canReschedule =
    status === "PENDING" || status === "CONFIRMED";

  const succeeded = attempted && !isPending && !state.error;

  useEffect(() => {
    if (!selectedDate) return;

    let cancelled = false;

    fetch(
      `/api/slots?professionalId=${professionalId}&serviceId=${serviceId}&date=${selectedDate}`
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
  }, [selectedDate, professionalId, serviceId]);

  if (!canReschedule) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        Reprogramar
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-medium">Reprogramar turno</h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Elegí la nueva fecha y horario.
            </p>

            <form action={formAction} className="mt-4 space-y-4">
              <fieldset>
                <label
                  htmlFor="reschedule-date"
                  className="mb-1 block text-sm font-medium"
                >
                  Fecha
                </label>
                <input
                  id="reschedule-date"
                  type="date"
                  required
                  min={new Date().toISOString().split("T")[0]}
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setSelectedSlot(null);
                    setSlots([]);
                    setLoadingSlots(true);
                  }}
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </fieldset>

              {selectedDate && (
                <div>
                  {loadingSlots ? (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      Cargando horarios...
                    </p>
                  ) : slots.length === 0 ? (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      No hay horarios disponibles para esta fecha.
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {slots.map((slot) => (
                        <button
                          key={slot.startTime}
                          type="button"
                          onClick={() => setSelectedSlot(slot)}
                          className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                            selectedSlot?.startTime === slot.startTime
                              ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                              : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                          }`}
                        >
                          {slot.startTime}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <input
                type="hidden"
                name="startsAt"
                value={selectedSlot?.startsAtUTC ?? ""}
              />

              {state.error && (
                <p
                  role="alert"
                  className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
                >
                  {state.error}
                </p>
              )}

              {succeeded && (
                <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
                  El turno fue reprogramado.
                </p>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!selectedSlot || isPending}
                  onClick={() => setAttempted(true)}
                  className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                >
                  {isPending ? "Reprogramando..." : "Confirmar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}