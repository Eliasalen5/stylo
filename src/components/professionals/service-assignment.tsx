"use client";

import { useActionState } from "react";
import { toggleProfessionalServices } from "@/app/actions/professionals";

type Service = {
  id: string;
  name: string;
  durationMinutes: number;
  price: number;
};

type Props = {
  professionalId: string;
  allServices: Service[];
  assignedServiceIds: string[];
};

export function ServiceAssignment({
  professionalId,
  allServices,
  assignedServiceIds,
}: Props) {
  const [state, formAction, isPending] = useActionState(
    async (_prev: { error?: string }, formData: FormData) => {
      const checked = formData.getAll("services") as string[];
      return toggleProfessionalServices(professionalId, checked);
    },
    {}
  );

  return (
    <div>
      <h2 className="text-lg font-medium">Servicios que ofrece</h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Seleccioná los servicios que este profesional puede realizar.
      </p>

      {allServices.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          No hay servicios creados. Creá servicios primero desde la sección de Servicios.
        </p>
      ) : (
        <form action={formAction} className="mt-4 space-y-3">
          {allServices.map((service) => (
            <label
              key={service.id}
              className="flex items-center gap-3 rounded-md border border-zinc-200 p-3 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
            >
              <input
                type="checkbox"
                name="services"
                value={service.id}
                defaultChecked={assignedServiceIds.includes(service.id)}
                className="h-4 w-4 rounded border-zinc-300"
              />
              <span className="text-sm">
                {service.name}{" "}
                <span className="text-zinc-500 dark:text-zinc-400">
                  ({service.durationMinutes} min)
                </span>
              </span>
            </label>
          ))}

          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {isPending ? "Guardando..." : "Guardar servicios"}
          </button>
          {state.error && (
            <p className="text-xs text-red-600 dark:text-red-400">{state.error}</p>
          )}
        </form>
      )}
    </div>
  );
}
