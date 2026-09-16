import { beforeEach, describe, it, expect, vi } from "vitest";

const BA = "America/Argentina/Buenos_Aires";

const mockDb = vi.hoisted(() => ({
  business: { findUnique: vi.fn() },
  service: { findFirst: vi.fn() },
  professional: { findFirst: vi.fn() },
  businessHours: { findMany: vi.fn() },
  appointment: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

import {
  getAvailableSlots,
  getEffectiveHours,
  isBookableSlot,
  hasConflict,
} from "@/lib/availability";

// Lunes 2026-09-14. Horarios del negocio: 09:00-13:00 y 14:00-18:00.
function mockDefaultHours() {
  mockDb.businessHours.findMany.mockImplementation(async ({ where }) => {
    if (where.professionalId === "prof-1") return [];
    return [
      { id: "h1", startTime: "09:00", endTime: "13:00", isActive: true },
      { id: "h2", startTime: "14:00", endTime: "18:00", isActive: true },
    ];
  });
}

beforeEach(() => {
  // Reloj congelado en un instante ANTERIOR al día de los fixtures (2026-09-14),
  // para que todos los slots de ese día sean futuros y la regla "debe ser
  // futuro" no los descarte. Los tests que prueban el comportamiento de slots
  // pasados mueven el reloj dentro del propio test.
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-12T12:00:00.000Z"));
  vi.clearAllMocks();
  mockDefaultHours();
});

describe("getAvailableSlots", () => {
  beforeEach(() => {
    mockDb.business.findUnique.mockResolvedValue({ timezone: BA });
    mockDb.service.findFirst.mockResolvedValue({ durationMinutes: 30 });
    mockDb.professional.findFirst.mockResolvedValue({ id: "prof-1" });
    mockDb.appointment.findMany.mockResolvedValue([]);
  });

  it("genera slots en la grilla de 30 minutos en hora local", async () => {
    const slots = await getAvailableSlots("biz-1", "prof-1", "svc-1", "2026-09-14");

    // 09:00-13:00 -> 8 slots (09:00, 09:30, ..., 12:30)
    // 14:00-18:00 -> 8 slots (14:00, ..., 17:30)
    expect(slots).toHaveLength(16);

    const first = slots[0];
    expect(first.startTime).toBe("09:00");
    // 09:00 local en BsAs = 12:00Z
    expect(first.startsAtUTC.toISOString()).toBe("2026-09-14T12:00:00.000Z");

    const last = slots[slots.length - 1];
    expect(last.startTime).toBe("17:30");
    expect(last.startsAtUTC.toISOString()).toBe("2026-09-14T20:30:00.000Z");
  });

  it("no genera slots que crucen la hora de cierre", async () => {
    // Un servicio de 90 minutos solo entra hasta las 11:30/16:30
    mockDb.service.findFirst.mockResolvedValue({ durationMinutes: 90 });
    const slots = await getAvailableSlots("biz-1", "prof-1", "svc-1", "2026-09-14");

    const times = slots.map((s) => s.startTime);
    expect(times).toEqual([
      "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
      "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
    ]);
  });

  it("marca como ocupado un slot que ya tiene turno", async () => {
    // Turno existente: 10:00-10:30 local (= 13:00Z-13:30Z).
    mockDb.appointment.findMany.mockResolvedValue([
      {
        startsAt: new Date("2026-09-14T13:00:00.000Z"),
        endsAt: new Date("2026-09-14T13:30:00.000Z"),
      },
    ]);

    const slots = await getAvailableSlots("biz-1", "prof-1", "svc-1", "2026-09-14");

    expect(slots.find((s) => s.startTime === "10:00")).toBeUndefined();
    expect(slots.find((s) => s.startTime === "09:30")).toBeDefined();
    expect(slots.find((s) => s.startTime === "10:30")).toBeDefined();
  });

  it("usa el turno del día anterior que cruza la medianoche como ocupación", async () => {
    // Turno del día anterior 23:30-00:30 local -> 02:30Z-03:30Z del 14.
    // Debe ocupar el primer slot (00:00-00:30 local) si hubiera horas de madrugada.
    mockDb.businessHours.findMany.mockImplementation(async ({ where }) => {
      if (where.professionalId !== null || where.professionalId) return [];
      return [{ id: "h", startTime: "00:00", endTime: "05:00", isActive: true }];
    });
    mockDb.appointment.findMany.mockResolvedValue([
      {
        startsAt: new Date("2026-09-14T02:30:00.000Z"),
        endsAt: new Date("2026-09-14T03:30:00.000Z"),
      },
    ]);

    const slots = await getAvailableSlots("biz-1", "prof-1", "svc-1", "2026-09-14");

    expect(slots.find((s) => s.startTime === "00:00")).toBeUndefined();
    expect(slots.find((s) => s.startTime === "03:30")).toBeDefined();
  });

  it("consulta turnos con predicado de overlap (no de contención)", async () => {
    mockDb.appointment.findMany.mockResolvedValue([]);
    await getAvailableSlots("biz-1", "prof-1", "svc-1", "2026-09-14");

    const where = mockDb.appointment.findMany.mock.calls[0][0].where;
    // Ventana del día local: 00:00 local (03:00Z) a medianoche (03:00Z del 15).
    expect(where.startsAt.lt.toISOString()).toBe("2026-09-15T03:00:00.000Z");
    expect(where.endsAt.gt.toISOString()).toBe("2026-09-14T03:00:00.000Z");
  });

  it("devuelve [] sin franjas para el día", async () => {
    mockDb.businessHours.findMany.mockResolvedValue([]);
    const slots = await getAvailableSlots("biz-1", "prof-1", "svc-1", "2026-09-14");
    expect(slots).toEqual([]);
  });

  it("no filtra el servicio fuera del negocio ni profesionales que no lo ofrecen", async () => {
    mockDb.service.findFirst.mockResolvedValue(null);
    const slots = await getAvailableSlots("biz-1", "prof-1", "svc-1", "2026-09-14");
    expect(slots).toEqual([]);
  });

  it("no ofrece slots que ya comenzaron en el día actual", async () => {
    // "Ahora" = 2026-09-14T12:59:00Z = 09:59 local (hoy, 4 minutos antes de las 10).
    vi.setSystemTime(new Date("2026-09-14T12:59:00.000Z"));
    const slots = await getAvailableSlots("biz-1", "prof-1", "svc-1", "2026-09-14");

    const times = slots.map((s) => s.startTime);
    expect(times).not.toContain("09:00");
    expect(times).not.toContain("09:30");
    expect(times[0]).toBe("10:00");
    // Todos los slots devueltos comienzan estrictamente en el futuro.
    for (const slot of slots) {
      expect(slot.startsAtUTC.getTime()).toBeGreaterThan(Date.now());
    }
  });
});

describe("getEffectiveHours", () => {
  it("usa las horas del profesional si existen para el día", async () => {
    mockDb.businessHours.findMany.mockImplementation(async ({ where }) => {
      if (where.professionalId === "prof-1") {
        return [{ id: "p1", startTime: "08:00", endTime: "12:00", isActive: true }];
      }
      return [{ id: "b", startTime: "09:00", endTime: "18:00", isActive: true }];
    });

    const hours = await getEffectiveHours("biz-1", "prof-1", "MONDAY");
    expect(hours).toHaveLength(1);
    expect(hours[0].startTime).toBe("08:00");
  });

  it("cae a las horas del negocio si el profesional no tiene horas ese día", async () => {
    const hours = await getEffectiveHours("biz-1", "prof-1", "MONDAY");
    expect(hours).toHaveLength(2);
    expect(hours[0].startTime).toBe("09:00");
  });
});

describe("isBookableSlot", () => {
  it("acepta un slot alineado a la grilla dentro del horario", async () => {
    const ok = await isBookableSlot({
      businessId: "biz-1",
      timezone: BA,
      professionalId: "prof-1",
      durationMinutes: 30,
      startsAt: new Date("2026-09-14T13:00:00.000Z"), // 10:00 local
      endsAt: new Date("2026-09-14T13:30:00.000Z"),
    });
    expect(ok).toBe(true);
  });

  it("rechaza un horario fuera de la franja", async () => {
    const ok = await isBookableSlot({
      businessId: "biz-1",
      timezone: BA,
      professionalId: "prof-1",
      durationMinutes: 30,
      startsAt: new Date("2026-09-14T11:30:00.000Z"), // 08:30 local
      endsAt: new Date("2026-09-14T12:00:00.000Z"),
    });
    expect(ok).toBe(false);
  });

  it("rechaza un inicio no alineado a la grilla de 30 minutos", async () => {
    const ok = await isBookableSlot({
      businessId: "biz-1",
      timezone: BA,
      professionalId: "prof-1",
      durationMinutes: 30,
      startsAt: new Date("2026-09-14T13:05:00.000Z"), // 10:05 local
      endsAt: new Date("2026-09-14T13:35:00.000Z"),
    });
    expect(ok).toBe(false);
  });

  it("rechaza una duración distinta al servicio", async () => {
    const ok = await isBookableSlot({
      businessId: "biz-1",
      timezone: BA,
      professionalId: "prof-1",
      durationMinutes: 30,
      startsAt: new Date("2026-09-14T13:00:00.000Z"),
      endsAt: new Date("2026-09-14T13:20:00.000Z"),
    });
    expect(ok).toBe(false);
  });

  it("rechaza un turno cuyo horario ya comenzó", async () => {
    // "Ahora" = 2026-09-14T13:00:00Z = 10:00 local.
    vi.setSystemTime(new Date("2026-09-14T13:00:00.000Z"));
    const ok = await isBookableSlot({
      businessId: "biz-1",
      timezone: BA,
      professionalId: "prof-1",
      durationMinutes: 30,
      startsAt: new Date("2026-09-14T12:30:00.000Z"), // 09:30 local (pasado)
      endsAt: new Date("2026-09-14T13:00:00.000Z"),
    });
    expect(ok).toBe(false);
  });
});

describe("hasConflict", () => {
  it("detecta conflicto cuando hay un turno solapado", async () => {
    mockDb.appointment.count.mockResolvedValue(1);
    const conflict = await hasConflict(
      "prof-1",
      new Date("2026-09-14T13:00:00.000Z"),
      new Date("2026-09-14T13:30:00.000Z")
    );
    expect(conflict).toBe(true);
  });

  it("no detecta conflicto cuando el rango está libre", async () => {
    mockDb.appointment.count.mockResolvedValue(0);
    const conflict = await hasConflict(
      "prof-1",
      new Date("2026-09-14T13:00:00.000Z"),
      new Date("2026-09-14T13:30:00.000Z")
    );
    expect(conflict).toBe(false);
  });

  it("excluye el turno actual al reprogramar", async () => {
    mockDb.appointment.count.mockResolvedValue(0);
    await hasConflict(
      "prof-1",
      new Date("2026-09-14T13:00:00.000Z"),
      new Date("2026-09-14T13:30:00.000Z"),
      "appt-1"
    );
    const where = mockDb.appointment.count.mock.calls[0][0].where;
    expect(where.id.not).toBe("appt-1");
  });
});