"use client";

import { useActionState } from "react";
import { upsertBusinessHours, type HoursState } from "@/app/actions/hours";

type Professional = {
  id: string;
  name: string;
};

type Props = {
  professionals: Professional[];
};

const DAYS = [
  { value: "MONDAY", label: "Lunes" },
  { value: "TUESDAY", label: "Martes" },
  { value: "WEDNESDAY", label: "Miércoles" },
  { value: "THURSDAY", label: "Jueves" },
  { value: "FRIDAY", label: "Viernes" },
  { value: "SATURDAY", label: "Sábado" },
  { value: "SUNDAY", label: "Domingo" },
] as const;

export function HoursForm({ professionals }: Props) {
  const [state, formAction, isPending] = useActionState(
    upsertBusinessHours,
    {} as HoursState
  );

  return (
    <form action={formAction} className="mt-4 space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <fieldset>
          <label htmlFor="dayOfWeek" className="mb-1 block text-sm font-medium">
            Día
          </label>
          <select
            id="dayOfWeek"
            name="dayOfWeek"
            required
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          >
            {DAYS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
          {state.fieldErrors?.dayOfWeek && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              {state.fieldErrors.dayOfWeek}
            </p>
          )}
        </fieldset>

        <fieldset>
          <label htmlFor="professionalId" className="mb-1 block text-sm font-medium">
            Profesional (opcional)
          </label>
          <select
            id="professionalId"
            name="professionalId"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">Todo el negocio</option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </fieldset>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">☀ Mañana</span>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                name="morningIsActive"
                defaultChecked
                className="h-3.5 w-3.5 rounded border-zinc-300"
              />
              <span className="text-xs text-zinc-500 dark:text-zinc-400">Activo</span>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <fieldset>
              <label htmlFor="morningStartTime" className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">
                Inicio
              </label>
              <input
                id="morningStartTime"
                name="morningStartTime"
                type="time"
                defaultValue="09:00"
                className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </fieldset>
            <fieldset>
              <label htmlFor="morningEndTime" className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">
                Fin
              </label>
              <input
                id="morningEndTime"
                name="morningEndTime"
                type="time"
                defaultValue="12:00"
                className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </fieldset>
          </div>
          {(state.fieldErrors?.morningStartTime || state.fieldErrors?.morningEndTime) && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              {state.fieldErrors?.morningStartTime || state.fieldErrors?.morningEndTime}
            </p>
          )}
        </div>

        <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">☽ Tarde</span>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                name="afternoonIsActive"
                defaultChecked
                className="h-3.5 w-3.5 rounded border-zinc-300"
              />
              <span className="text-xs text-zinc-500 dark:text-zinc-400">Activo</span>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <fieldset>
              <label htmlFor="afternoonStartTime" className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">
                Inicio
              </label>
              <input
                id="afternoonStartTime"
                name="afternoonStartTime"
                type="time"
                defaultValue="14:00"
                className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </fieldset>
            <fieldset>
              <label htmlFor="afternoonEndTime" className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">
                Fin
              </label>
              <input
                id="afternoonEndTime"
                name="afternoonEndTime"
                type="time"
                defaultValue="19:00"
                className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </fieldset>
          </div>
          {(state.fieldErrors?.afternoonStartTime || state.fieldErrors?.afternoonEndTime) && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              {state.fieldErrors?.afternoonStartTime || state.fieldErrors?.afternoonEndTime}
            </p>
          )}
        </div>
      </div>

      {state.error && (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
        >
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {isPending ? "Guardando..." : "Guardar horario"}
      </button>
    </form>
  );
}
