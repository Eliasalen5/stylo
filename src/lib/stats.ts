import { db } from "@/lib/db";
import { toTimezoneComponents } from "@/lib/datetime";
import type { AppointmentStatus } from "@/generated/prisma/client";

/**
 * Estadísticas de un negocio. Se calculan desde la tabla Appointment (que ya
 * guarda el precio snapshot, el estado, el profesional y el servicio), sin
 * tablas agregadas: suficiente para el MVP. Si crece, se agrega agregación
 * programada.
 */

export type StatusCount = { status: string; count: number };

export type EntityMetric = {
  id: string;
  name: string;
  count: number;
  revenue: number;
};

export type DailyPoint = {
  date: string; // YYYY-MM-DD en la timezone del negocio
  count: number;
  revenue: number;
};

export type BusinessStats = {
  periodDays: number;
  totals: {
    total: number;
    pending: number;
    confirmed: number;
    completed: number;
    cancelled: number;
    noShow: number;
  };
  // Ingresos por estado (solo estados que no son cancelación).
  revenue: { confirmed: number; completed: number; total: number };
  byService: EntityMetric[];
  byProfessional: EntityMetric[];
  daily: DailyPoint[];
};

const REVENUE_STATUSES: AppointmentStatus[] = ["CONFIRMED", "COMPLETED"];

type RangeAppointment = {
  serviceId: string;
  professionalId: string;
  startsAt: Date;
  price: number;
  status: string;
};

/**
 * Agrega turnos por entidad (servicio/profesional) sobre la ventana dada.
 */
function aggregateByEntity(
  appointments: RangeAppointment[],
  keyOf: "serviceId" | "professionalId"
): Map<string, EntityMetric> {
  const map = new Map<string, EntityMetric>();

  for (const a of appointments) {
    const key = a[keyOf];
    const entry = map.get(key) ?? { id: key, name: "", count: 0, revenue: 0 };
    entry.count += 1;
    if ((REVENUE_STATUSES as readonly string[]).includes(a.status)) {
      entry.revenue += a.price;
    }
    map.set(key, entry);
  }

  return map;
}

/**
 * Calcula las métricas completas del negocio.
 *
 * @param businessId   ID del negocio (tenant ya validado por el caller).
 * @param periodDays   Ventana para la serie diaria y el desglose por entidad.
 * @param timezone     Zona horaria del negocio (para agrupar los días).
 */
export async function getBusinessStats(
  businessId: string,
  periodDays = 30,
  timezone = "UTC"
): Promise<BusinessStats> {
  const to = new Date();
  const from = new Date(to.getTime() - periodDays * 24 * 60 * 60 * 1000);

  const [statusGroup, revenueGroup, range] = await Promise.all([
    db.appointment.groupBy({
      by: ["status"],
      where: { businessId },
      _count: { _all: true },
    }),
    db.appointment.groupBy({
      by: ["status"],
      where: { businessId, status: { in: REVENUE_STATUSES } },
      _sum: { price: true },
    }),
    db.appointment.findMany({
      where: { businessId, startsAt: { gte: from, lt: to } },
      select: {
        serviceId: true,
        professionalId: true,
        startsAt: true,
        price: true,
        status: true,
      },
    }),
  ]);

  const statusOf = (status: string) =>
    statusGroup.find((s) => s.status === status)?._count._all ?? 0;

  const totals = {
    total: statusGroup.reduce((acc, s) => acc + s._count._all, 0),
    pending: statusOf("PENDING"),
    confirmed: statusOf("CONFIRMED"),
    completed: statusOf("COMPLETED"),
    cancelled: statusOf("CANCELLED"),
    noShow: statusOf("NO_SHOW"),
  };

  const revenue = {
    confirmed: revenueGroup.find((s) => s.status === "CONFIRMED")?._sum.price ?? 0,
    completed: revenueGroup.find((s) => s.status === "COMPLETED")?._sum.price ?? 0,
    total: 0,
  };
  revenue.total = revenue.confirmed + revenue.completed;

  // Serie diaria agrupada por día local del negocio y desglose por entidad.
  const dailyMap = new Map<string, { count: number; revenue: number }>();
  const serviceMap = aggregateByEntity(range, "serviceId");
  const professionalMap = aggregateByEntity(range, "professionalId");

  for (const a of range) {
    const day = toTimezoneComponents(a.startsAt, timezone).dateStr;
    const point = dailyMap.get(day) ?? { count: 0, revenue: 0 };
    point.count += 1;
    if ((REVENUE_STATUSES as readonly string[]).includes(a.status)) {
      point.revenue += a.price;
    }
    dailyMap.set(day, point);
  }

  const daily: DailyPoint[] = Array.from(dailyMap.entries())
    .map(([date, point]) => ({ date, ...point }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Resolver nombres de servicios y profesionales del desglose.
  const serviceIds = Array.from(serviceMap.keys());
  const professionalIds = Array.from(professionalMap.keys());

  const [services, professionals] = await Promise.all([
    db.service.findMany({
      where: { id: { in: serviceIds }, businessId },
      select: { id: true, name: true },
    }),
    db.professional.findMany({
      where: { id: { in: professionalIds }, businessId },
      select: { id: true, name: true },
    }),
  ]);

  const serviceName = new Map(services.map((s) => [s.id, s.name]));
  const professionalName = new Map(professionals.map((p) => [p.id, p.name]));

  const byService = Array.from(serviceMap.values())
    .map((m) => ({ ...m, name: serviceName.get(m.id) ?? "—" }))
    .sort((a, b) => b.count - a.count);

  const byProfessional = Array.from(professionalMap.values())
    .map((m) => ({ ...m, name: professionalName.get(m.id) ?? "—" }))
    .sort((a, b) => b.count - a.count);

  return { periodDays, totals, revenue, byService, byProfessional, daily };
}