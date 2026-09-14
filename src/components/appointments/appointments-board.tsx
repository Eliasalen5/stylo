"use client";

import { useState } from "react";
import { AppointmentCard } from "./appointment-card";
import { DayTimeline } from "./day-timeline";

export type AppointmentListItem = {
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

export function AppointmentsBoard({
  appointments,
  professionals,
  timezone,
  openTime,
  closeTime,
}: {
  appointments: AppointmentListItem[];
  professionals: { id: string; name: string }[];
  timezone: string;
  openTime: string;
  closeTime: string;
}) {
  const [view, setView] = useState<"agenda" | "lista">("agenda");

  const baseClasses = "rounded-md border px-3 py-1.5 text-xs font-medium";
  const activeClasses =
    "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900";
  const inactiveClasses =
    "border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800";

  return (
    <div className="mt-4">
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => setView("agenda")}
          className={`${baseClasses} ${view === "agenda" ? activeClasses : inactiveClasses}`}
        >
          Agenda del día
        </button>
        <button
          type="button"
          onClick={() => setView("lista")}
          className={`${baseClasses} ${view === "lista" ? activeClasses : inactiveClasses}`}
        >
          Lista
        </button>
      </div>

      {view === "agenda" ? (
        <DayTimeline
          appointments={appointments.map((a) => ({
            id: a.id,
            startsAt: a.startsAt.toISOString(),
            endsAt: a.endsAt.toISOString(),
            status: a.status,
            professional: a.professional,
            service: a.service,
            customer: a.customer,
          }))}
          professionals={professionals}
          timezone={timezone}
          openTime={openTime}
          closeTime={closeTime}
        />
      ) : (
        <div className="mt-4 space-y-3">
          {appointments.map((appt) => (
            <AppointmentCard
              key={appt.id}
              appointment={appt}
              timezone={timezone}
            />
          ))}
        </div>
      )}
    </div>
  );
}