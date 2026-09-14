"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { AppointmentState } from "@/app/actions/appointments";

export type WizardProfessional = {
  id: string;
  name: string;
  services: { id: string; name: string; durationMinutes: number; price: number }[];
};

export type WizardService = {
  id: string;
  name: string;
  durationMinutes: number;
  price: number;
};

export type WizardCustomer = {
  id: string;
  name: string;
  email: string | null;
};

type Slot = {
  startTime: string;
  endTime: string;
  startsAtUTC: string;
};

type Props = {
  professionals: WizardProfessional[];
  services: WizardService[];
  customers: WizardCustomer[];
  state: AppointmentState;
  isPending: boolean;
  formAction: (formData: FormData) => void;
};

export function BookingWizard({
  professionals,
  services,
  customers,
  state,
  isPending,
  formAction,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [selectedService, setSelectedService] = useState<string>("");
  const [selectedProfessional, setSelectedProfessional] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const filteredProfessionals = selectedService
    ? professionals.filter((p) =>
        p.services.some((s) => s.id === selectedService)
      )
    : professionals;

  const filteredServices = selectedProfessional
    ? services.filter((s) =>
        professionals
          .find((p) => p.id === selectedProfessional)
          ?.services.some((ps) => ps.id === s.id)
      )
    : services;

  // Cargar slots cuando cambia fecha + profesional + servicio.
  // El reset de estado se hace en los handlers de cambio (no en el effect).
  useEffect(() => {
    if (!selectedDate || !selectedProfessional || !selectedService) return;

    let cancelled = false;

    fetch(
      `/api/slots?professionalId=${selectedProfessional}&serviceId=${selectedService}&date=${selectedDate}`
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
  }, [selectedDate, selectedProfessional, selectedService]);

  const selectedServiceData = services.find((s) => s.id === selectedService);

  return (
    <form action={formAction} className="mt-6 space-y-6">
      {/* Step 1: Servicio */}
      {step === 1 && (
        <div>
          <h2 className="text-lg font-medium">1. Elegí el servicio</h2>
          <div className="mt-3 space-y-2">
            {filteredServices.map((s) => (
              <label
                key={s.id}
                className={`flex cursor-pointer items-center justify-between rounded-md border p-3 transition-colors ${
                  selectedService === s.id
                    ? "border-zinc-900 bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-900"
                    : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                }`}
              >
                <div>
                  <span className="text-sm font-medium">{s.name}</span>
                  <span className="ml-2 text-sm text-zinc-500 dark:text-zinc-400">
                    {s.durationMinutes} min
                  </span>
                </div>
                <span className="text-sm font-medium">
                  ${s.price.toLocaleString("es-AR")}
                </span>
                <input
                  type="radio"
                  name="serviceId"
                  value={s.id}
                  checked={selectedService === s.id}
                  onChange={() => {
                    setSelectedService(s.id);
                    setSelectedProfessional("");
                    setSelectedSlot(null);
                    setSlots([]);
                    setLoadingSlots(true);
                  }}
                  className="sr-only"
                />
              </label>
            ))}
          </div>
          {state.fieldErrors?.serviceId && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              {state.fieldErrors.serviceId}
            </p>
          )}
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              disabled={!selectedService}
              onClick={() => setStep(2)}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Siguiente
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Profesional */}
      {step === 2 && (
        <div>
          <h2 className="text-lg font-medium">2. Elegí el profesional</h2>
          <div className="mt-3 space-y-2">
            {filteredProfessionals.map((p) => (
              <label
                key={p.id}
                className={`flex cursor-pointer items-center rounded-md border p-3 transition-colors ${
                  selectedProfessional === p.id
                    ? "border-zinc-900 bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-900"
                    : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                }`}
              >
                <span className="text-sm font-medium">{p.name}</span>
                <input
                  type="radio"
                  name="professionalId"
                  value={p.id}
                  checked={selectedProfessional === p.id}
                  onChange={() => {
                    setSelectedProfessional(p.id);
                    setSelectedSlot(null);
                    setSlots([]);
                    setLoadingSlots(true);
                  }}
                  className="sr-only"
                />
              </label>
            ))}
          </div>
          {state.fieldErrors?.professionalId && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              {state.fieldErrors.professionalId}
            </p>
          )}
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Atras
            </button>
            <button
              type="button"
              disabled={!selectedProfessional}
              onClick={() => setStep(3)}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Fecha y hora */}
      {step === 3 && (
        <div>
          <h2 className="text-lg font-medium">3. Elegí fecha y hora</h2>
          <fieldset className="mt-3">
            <label htmlFor="date" className="mb-1 block text-sm font-medium">
              Fecha
            </label>
            <input
              id="date"
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

          {state.fieldErrors?.time && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              {state.fieldErrors.time}
            </p>
          )}

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Atras
            </button>
            <button
              type="button"
              disabled={!selectedSlot}
              onClick={() => setStep(4)}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Cliente */}
      {step === 4 && (
        <div>
          <h2 className="text-lg font-medium">4. Elegí el cliente</h2>
          <div className="mt-3 space-y-2">
            {customers.map((c) => (
              <label
                key={c.id}
                className={`flex cursor-pointer items-center rounded-md border p-3 transition-colors ${
                  selectedCustomer === c.id
                    ? "border-zinc-900 bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-900"
                    : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                }`}
              >
                <div>
                  <span className="text-sm font-medium">{c.name}</span>
                  {c.email && (
                    <span className="ml-2 text-sm text-zinc-500 dark:text-zinc-400">
                      {c.email}
                    </span>
                  )}
                </div>
                <input
                  type="radio"
                  name="customerId"
                  value={c.id}
                  checked={selectedCustomer === c.id}
                  onChange={() => setSelectedCustomer(c.id)}
                  className="sr-only"
                />
              </label>
            ))}
          </div>
          {state.fieldErrors?.customerId && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              {state.fieldErrors.customerId}
            </p>
          )}

          {/* Resumen */}
          {selectedSlot && selectedServiceData && (
            <div className="mt-4 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
              <h3 className="text-sm font-medium">Resumen</h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {selectedServiceData.name} - {selectedSlot.startTime} al {selectedSlot.endTime}
              </p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                ${selectedServiceData.price.toLocaleString("es-AR")}
              </p>
            </div>
          )}

          {/* Hidden fields */}
          <input type="hidden" name="serviceId" value={selectedService} />
          <input type="hidden" name="professionalId" value={selectedProfessional} />
          <input type="hidden" name="startsAt" value={selectedSlot?.startsAtUTC ?? ""} />

          {state.error && (
            <p
              role="alert"
              className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
            >
              {state.error}
            </p>
          )}

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() => setStep(3)}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Atras
            </button>
            <button
              type="submit"
              disabled={!selectedCustomer || isPending}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {isPending ? "Creando..." : "Confirmar turno"}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
