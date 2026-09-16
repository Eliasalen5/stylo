"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type Service = {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: number;
};

type Professional = {
  id: string;
  name: string;
  services: { id: string; name: string; durationMinutes: number; price: number }[];
};

type Slot = {
  startTime: string;
  endTime: string;
  startsAtUTC: string;
};

type Props = {
  businessSlug: string;
  services: Service[];
  professionals: Professional[];
};

export function PublicBooking({ businessSlug, services, professionals }: Props) {
  const [step, setStep] = useState(1);
  const [selectedService, setSelectedService] = useState<string>("");
  const [selectedProfessional, setSelectedProfessional] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Customer form
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

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

  async function handleSubmit() {
    if (!selectedSlot || !customerName || !customerEmail) return;

    setSubmitting(true);
    setError(null);

    try {
      // 1. Buscar o crear cliente (el negocio se deriva del slug en el servidor)
      const customerRes = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: customerName,
          email: customerEmail,
          phone: customerPhone || null,
          businessSlug,
        }),
      });

      const customerData = await customerRes.json();
      if (!customerData.id) {
        setError(customerData.error ?? "Error al procesar el cliente.");
        setSubmitting(false);
        return;
      }

      // 2. Crear turno (el negocio se deriva del profesional en el servidor)
      const apptRes = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: selectedService,
          professionalId: selectedProfessional,
          customerId: customerData.id,
          startsAt: selectedSlot.startsAtUTC,
        }),
      });

      const apptData = await apptRes.json();
      if (apptData.error) {
        setError(apptData.error);
        setSubmitting(false);
        return;
      }

      setSuccess(true);
    } catch {
      setError("Error al crear el turno. Intentalo de nuevo.");
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center dark:border-green-900 dark:bg-green-950">
        <h2 className="text-lg font-semibold text-green-800 dark:text-green-300">
          Turno confirmado
        </h2>
        <p className="mt-2 text-sm text-green-700 dark:text-green-400">
          Tu turno fue registrado correctamente.
        </p>
        <p className="mt-1 text-sm text-green-700 dark:text-green-400">
          {selectedServiceData?.name} el {selectedDate} a las {selectedSlot?.startTime}
        </p>
        <Link
          href="/"
          className="mt-4 inline-block rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Volver al inicio
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Step 1: Servicio */}
      {step === 1 && (
        <div>
          <h2 className="text-lg font-medium">Elegi el servicio</h2>
          <div className="mt-3 space-y-2">
            {filteredServices.map((s) => (
              <label
                key={s.id}
                className={`flex cursor-pointer items-center justify-between rounded-md border p-3 transition-colors ${
                  selectedService === s.id
                    ? "border-zinc-900 bg-white dark:border-zinc-100 dark:bg-zinc-900"
                    : "border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
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
          <button
            type="button"
            disabled={!selectedService}
            onClick={() => setStep(2)}
            className="mt-4 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Siguiente
          </button>
        </div>
      )}

      {/* Step 2: Profesional */}
      {step === 2 && (
        <div>
          <h2 className="text-lg font-medium">Elegi el profesional</h2>
          <div className="mt-3 space-y-2">
            {filteredProfessionals.map((p) => (
              <label
                key={p.id}
                className={`flex cursor-pointer items-center rounded-md border p-3 transition-colors ${
                  selectedProfessional === p.id
                    ? "border-zinc-900 bg-white dark:border-zinc-100 dark:bg-zinc-900"
                    : "border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                }`}
              >
                <span className="text-sm font-medium">{p.name}</span>
                <input
                  type="radio"
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
          <h2 className="text-lg font-medium">Elegi fecha y hora</h2>
          <fieldset className="mt-3">
            <label htmlFor="pub-date" className="mb-1 block text-sm font-medium">
              Fecha
            </label>
            <input
              id="pub-date"
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
                          : "border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                      }`}
                    >
                      {slot.startTime}
                    </button>
                  ))}
                </div>
              )}
            </div>
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

      {/* Step 4: Datos del cliente */}
      {step === 4 && (
        <div>
          <h2 className="text-lg font-medium">Tus datos</h2>
          <div className="mt-3 space-y-4">
            <fieldset>
              <label htmlFor="pub-name" className="mb-1 block text-sm font-medium">
                Nombre completo
              </label>
              <input
                id="pub-name"
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Juan Perez"
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </fieldset>
            <fieldset>
              <label htmlFor="pub-email" className="mb-1 block text-sm font-medium">
                Email
              </label>
              <input
                id="pub-email"
                type="email"
                required
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="juan@ejemplo.com"
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </fieldset>
            <fieldset>
              <label htmlFor="pub-phone" className="mb-1 block text-sm font-medium">
                Telefono (opcional)
              </label>
              <input
                id="pub-phone"
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="+54 11 5555 5555"
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </fieldset>
          </div>

          {/* Resumen */}
          {selectedSlot && selectedServiceData && (
            <div className="mt-4 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
              <h3 className="text-sm font-medium">Resumen del turno</h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {selectedServiceData.name} - {selectedSlot.startTime} al {selectedSlot.endTime}
              </p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                ${selectedServiceData.price.toLocaleString("es-AR")}
              </p>
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
            >
              {error}
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
              type="button"
              disabled={!customerName || !customerEmail || submitting}
              onClick={handleSubmit}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {submitting ? "Confirmando..." : "Confirmar turno"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
