import { db } from "@/lib/db";
import { requireCurrentBusiness } from "@/lib/current-business";
import { HoursForm } from "@/components/hours/hours-form";
import { DeleteHoursButton } from "@/components/hours/delete-hours-button";
import type { WeekDay } from "@/generated/prisma/client";

const DAY_LABELS: Record<WeekDay, string> = {
  MONDAY: "Lunes",
  TUESDAY: "Martes",
  WEDNESDAY: "Miércoles",
  THURSDAY: "Jueves",
  FRIDAY: "Viernes",
  SATURDAY: "Sábado",
  SUNDAY: "Domingo",
};

const DAY_ORDER: WeekDay[] = [
  "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY",
];

export default async function HoursPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const business = await requireCurrentBusiness(params);

  const [hours, professionals] = await Promise.all([
    db.businessHours.findMany({
      where: { businessId: business.id },
      include: {
        professional: { select: { id: true, name: true } },
      },
      orderBy: { startTime: "asc" },
    }),
    db.professional.findMany({
      where: { businessId: business.id },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const groupedByDay = DAY_ORDER.map((day) => {
    const dayEntries = hours.filter((h) => h.dayOfWeek === day);

    const byProfessional = new Map<
      string,
      { name: string | null; morning: typeof dayEntries; afternoon: typeof dayEntries }
    >();

    for (const entry of dayEntries) {
      const key = entry.professionalId ?? "__business__";
      if (!byProfessional.has(key)) {
        byProfessional.set(key, {
          name: entry.professional?.name ?? null,
          morning: [],
          afternoon: [],
        });
      }
      const group = byProfessional.get(key)!;
      if (entry.startTime < "12:00") {
        group.morning.push(entry);
      } else {
        group.afternoon.push(entry);
      }
    }

    return { day, label: DAY_LABELS[day], byProfessional };
  });

  return (
    <div className="w-full max-w-3xl">
      <h1 className="text-2xl font-semibold">Horarios</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Configurá los horarios de atención de tu negocio.
      </p>

      <div className="mt-6 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="font-medium">Nuevo horario</h2>
        <HoursForm professionals={professionals} />
      </div>

      <div className="mt-6 space-y-5">
        {groupedByDay.map(({ day, label, byProfessional }) => (
          <div key={day}>
            <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              {label}
            </h3>
            {byProfessional.size === 0 ? (
              <p className="mt-1 text-sm text-zinc-400 dark:text-zinc-500">
                Sin horarios configurados
              </p>
            ) : (
              <div className="mt-2 space-y-2">
                {Array.from(byProfessional.entries()).map(
                  ([key, { name, morning, afternoon }]) => (
                    <div
                      key={key}
                      className="rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800"
                    >
                      <div className="mb-2 text-sm font-medium">
                        {name ?? "Todo el negocio"}
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {morning.map((entry) => (
                          <div
                            key={entry.id}
                            className="flex items-center gap-2"
                          >
                            <span className="text-sm">☀</span>
                            <span className="text-sm">
                              {entry.startTime} – {entry.endTime}
                            </span>
                            {!entry.isActive && (
                              <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-400 dark:bg-zinc-800">
                                inactivo
                              </span>
                            )}
                            <DeleteHoursButton hoursId={entry.id} />
                          </div>
                        ))}
                        {afternoon.map((entry) => (
                          <div
                            key={entry.id}
                            className="flex items-center gap-2"
                          >
                            <span className="text-sm">☽</span>
                            <span className="text-sm">
                              {entry.startTime} – {entry.endTime}
                            </span>
                            {!entry.isActive && (
                              <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-400 dark:bg-zinc-800">
                                inactivo
                              </span>
                            )}
                            <DeleteHoursButton hoursId={entry.id} />
                          </div>
                        ))}
                        {morning.length === 0 && afternoon.length === 0 && (
                          <p className="text-xs text-zinc-400 dark:text-zinc-500">
                            Sin franjas configuradas
                          </p>
                        )}
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
