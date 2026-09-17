import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDb = vi.hoisted(() => ({
  appointment: {
    groupBy: vi.fn(),
    findMany: vi.fn(),
  },
  service: { findMany: vi.fn() },
  professional: { findMany: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

import { getBusinessStats } from "@/lib/stats";

const TZ = "America/Argentina/Buenos_Aires"; // UTC-3

function statusGroups() {
  return [
    { status: "PENDING", _count: { _all: 1 } },
    { status: "CONFIRMED", _count: { _all: 4 } },
    { status: "COMPLETED", _count: { _all: 5 } },
    { status: "CANCELLED", _count: { _all: 2 } },
    { status: "NO_SHOW", _count: { _all: 1 } },
  ];
}

function revenueGroups() {
  return [
    { status: "CONFIRMED", _sum: { price: 4000 } },
    { status: "COMPLETED", _sum: { price: 10000 } },
  ];
}

function rangeAppointments() {
  const base = new Date("2026-09-10T13:00:00.000Z"); // 10:00 local
  const plus = (h: number) => new Date(base.getTime() + h * 3600 * 1000);
  return [
    { serviceId: "svc-1", professionalId: "prof-1", startsAt: plus(0), price: 1000, status: "CONFIRMED" },
    { serviceId: "svc-1", professionalId: "prof-1", startsAt: plus(24), price: 1000, status: "COMPLETED" },
    { serviceId: "svc-2", professionalId: "prof-2", startsAt: plus(48), price: 2000, status: "CANCELLED" },
    { serviceId: "svc-2", professionalId: "prof-2", startsAt: plus(72), price: 2000, status: "CANCELLED" },
  ];
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-20T12:00:00.000Z"));

  mockDb.appointment.groupBy.mockImplementation(async ({ where }) => {
    if (where?.status?.in) return revenueGroups();
    return statusGroups();
  });

  mockDb.appointment.findMany.mockResolvedValue(rangeAppointments());
  mockDb.service.findMany.mockImplementation(async ({ where }) =>
    where.id.in.map((id: string) => ({ id, name: `Servicio ${id}` }))
  );
  mockDb.professional.findMany.mockImplementation(async ({ where }) =>
    where.id.in.map((id: string) => ({ id, name: `Profe ${id}` }))
  );
});

describe("getBusinessStats", () => {
  it("resume totales y estados", async () => {
    const stats = await getBusinessStats("biz-1", 30, TZ);
    expect(stats.totals).toEqual({
      total: 13,
      pending: 1,
      confirmed: 4,
      completed: 5,
      cancelled: 2,
      noShow: 1,
    });
    expect(stats.revenue.total).toBe(14000);
  });

  it("agrupa la serie diaria por día local del negocio", async () => {
    const stats = await getBusinessStats("biz-1", 30, TZ);
    expect(stats.daily.length).toBe(4);
    expect(stats.daily[0].date).toBe("2026-09-10");
  });

  it("cuenta ingresos solo de estados no cancelados", async () => {
    const stats = await getBusinessStats("biz-1", 30, TZ);
    const revenueDays = stats.daily.reduce((acc, d) => acc + d.revenue, 0);
    // Ganó 1000 (CONFIRMED) + 1000 (COMPLETED); los 2 CANCELLED no suman.
    expect(revenueDays).toBe(2000);
  });

  it("desglosa por servicio y profesional con nombres resueltos", async () => {
    const stats = await getBusinessStats("biz-1", 30, TZ);
    const service = stats.byService.find((s) => s.id === "svc-1");
    expect(service?.name).toBe("Servicio svc-1");
    expect(service?.count).toBe(2);
    const professional = stats.byProfessional.find((p) => p.id === "prof-1");
    expect(professional?.name).toBe("Profe prof-1");
  });
});