"use client";

import { useActionState } from "react";
import { updateBusiness, type UpdateBusinessState } from "@/app/actions/business";
import { ARGENTINA_TIMEZONES } from "@/lib/timezones";

type BusinessProfile = {
  name: string;
  description: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  timezone: string;
  latitude: number | null;
  longitude: number | null;
};

export function BusinessProfileForm({
  business,
}: {
  business: BusinessProfile;
}) {
  const [currentState, formAction, isPending] = useActionState(
    updateBusiness,
    {} as UpdateBusinessState
  );

  const errors = currentState.fieldErrors;
  const generalError = currentState.error;
  const success = currentState.success;

  return (
    <form action={formAction} className="mt-6 space-y-5">
      {generalError && (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
        >
          {generalError}
        </p>
      )}
      {success && (
        <p
          role="status"
          className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
        >
          Cambios guardados.
        </p>
      )}

      <fieldset>
        <label htmlFor="name" className="mb-1 block text-sm font-medium">
          Nombre
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          maxLength={120}
          defaultValue={business.name}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
        {errors?.name && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.name}</p>
        )}
      </fieldset>

      <fieldset>
        <label htmlFor="description" className="mb-1 block text-sm font-medium">
          Descripción (opcional)
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          maxLength={500}
          defaultValue={business.description ?? ""}
          placeholder="Describí tu negocio..."
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
        {errors?.description && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">
            {errors.description}
          </p>
        )}
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <fieldset>
          <label htmlFor="phone" className="mb-1 block text-sm font-medium">
            Teléfono (opcional)
          </label>
          <input
            id="phone"
            name="phone"
            type="text"
            maxLength={30}
            defaultValue={business.phone ?? ""}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
          {errors?.phone && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.phone}</p>
          )}
        </fieldset>

        <fieldset>
          <label htmlFor="email" className="mb-1 block text-sm font-medium">
            Email (opcional)
          </label>
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={business.email ?? ""}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
          {errors?.email && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.email}</p>
          )}
        </fieldset>
      </div>

      <fieldset>
        <label htmlFor="address" className="mb-1 block text-sm font-medium">
          Dirección (opcional)
        </label>
        <input
          id="address"
          name="address"
          type="text"
          maxLength={200}
          defaultValue={business.address ?? ""}
          placeholder="Ej: Av. Corrientes 1234, Buenos Aires"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Al guardar se intenta obtener la ubicación automáticamente (Google Maps).
        </p>
        {errors?.address && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">
            {errors.address}
          </p>
        )}
      </fieldset>

      <fieldset>
        <label htmlFor="timezone" className="mb-1 block text-sm font-medium">
          Zona horaria
        </label>
        <select
          id="timezone"
          name="timezone"
          defaultValue={business.timezone}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        >
          {ARGENTINA_TIMEZONES.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </select>
        {errors?.timezone && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">
            {errors.timezone}
          </p>
        )}
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <fieldset>
          <label htmlFor="latitude" className="mb-1 block text-sm font-medium">
            Latitud (opcional)
          </label>
          <input
            id="latitude"
            name="latitude"
            type="number"
            step="any"
            min={-90}
            max={90}
            defaultValue={business.latitude ?? ""}
            placeholder="-34.6037"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
          {errors?.latitude && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              {errors.latitude}
            </p>
          )}
        </fieldset>

        <fieldset>
          <label htmlFor="longitude" className="mb-1 block text-sm font-medium">
            Longitud (opcional)
          </label>
          <input
            id="longitude"
            name="longitude"
            type="number"
            step="any"
            min={-180}
            max={180}
            defaultValue={business.longitude ?? ""}
            placeholder="-58.3816"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
          {errors?.longitude && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              {errors.longitude}
            </p>
          )}
        </fieldset>
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Coordenadas manuales (opcional): completá ambas si querés fijar la ubicación
        exacta sin depender del geocoding automático.
      </p>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {isPending ? "Guardando..." : "Guardar cambios"}
      </button>
    </form>
  );
}