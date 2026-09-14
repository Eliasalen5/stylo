"use client";

import { toTimezoneComponents, toMinutes } from "@/lib/datetime";

export type TimelineAppointment = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  professional: { id: string; name: string };
  service: { id: string; name: string };
  customer: { id: string; name: string };
};

const STATUS_STYLE: Record<string, string> = {
  PENDING:
    "border-amber-400 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  CONFIRMED:
    "border-green-400 bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-200",
  COMPLETED: "border-zinc-300 bg-zinc-50 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
  CANCELLED:
    "border-red-300 bg-red-50 text-red-700 line-through dark:bg-red-950 dark:text-red-300",
  NO_SHOW:
    "border-zinc-300 bg-zinc-100 text-zinc-500 line-through dark:bg-zinc-900 dark:text-zinc-600",
};

function formatHH(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:00`;
}

export function DayTimeline({
  appointments,
  professionals,
  timezone,
  openTime,
  closeTime,
}: {
  appointments: TimelineAppointment[];
  professionals: { id: string; name: string }[];
  timezone: string;
  openTime: string;
  closeTime: string;
}) {
  const openMin = toMinutes(openTime);
  const total = Math.max(toMinutes(closeTime) - openMin, 60);

  const hours: string[] = [];
  for (
    let m = openMin + ((60 - (openMin % 60)) % 60);
    m <= openMin + total;
    m += 60
  ) {
    hours.push(formatHH(m));
  }

  const pct = (min: number) => ((min - openMin) / total) * 100;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px]">
        <div className="relative ml-28 h-5">
          {hours.map((h) => (
            <span
              key={h}
              className="absolute -translate-x-1/2 text-[10px] text-zinc-400 dark:text-zinc-500"
              style={{ left: `${pct(toMinutes(h))}%` }}
            >
              {h}
            </span>
          ))}
        </div>

        {professionals.map((p) => {
          const appts = appointments.filter((a) => a.professional.id === p.id);

          return (
            <div key={p.id} className="mt-1 flex">
              <div className="w-28 shrink-0 truncate pr-2 pt-2 text-xs text-zinc-500 dark:text-zinc-400">
                {p.name}
              </div>
              <div className="relative h-11 flex-1 rounded border border-zinc-100 dark:border-zinc-900">
                {hours.map((h) => (
                  <div
                    key={h}
                    className="absolute inset-y-0 w-px bg-zinc-100 dark:bg-zinc-900"
                    style={{ left: `${pct(toMinutes(h))}%` }}
                  />
                ))}

                {appts.map((a) => {
                  const startStr = toTimezoneComponents(
                    new Date(a.startsAt),
                    timezone
                  ).timeStr;
                  const endStr = toTimezoneComponents(
                    new Date(a.endsAt),
                    timezone
                  ).timeStr;
                  const left = pct(toMinutes(startStr));
                  const width = pct(toMinutes(endStr)) - left;

                  return (
                    <button
                      key={a.id}
                      type="button"
                      title={`${a.customer.name} - ${a.service.name} (${startStr} - ${endStr})`}
                      className={`absolute top-1 h-9 overflow-hidden truncate rounded border px-1.5 text-[11px] font-medium transition-opacity hover:opacity-80 ${STATUS_STYLE[a.status] ?? ""}`}
                      style={{ left: `${left}%`, width: `max(${width}%, 22px)` }}
                    >
                      {width > 10 ? `${startStr} ${a.customer.name}` : ""}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}