import { beforeEach, describe, it, expect, vi } from "vitest";

const BA = "America/Argentina/Buenos_Aires";

const mockDb = vi.hoisted(() => ({
  service: { findFirst: vi.fn() },
  professional: { findFirst: vi.fn() },
  customer: { findFirst: vi.fn() },
  businessHours: { findMany: vi.fn() },
  appointment: { count: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

import { createBooking, BookingConflict } from "@/lib/booking";

function makeTx(options?: { conflict?: boolean; createdId?: string }) {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    appointment: {
      count: vi.fn().mockResolvedValue(options?.conflict ? 1 : 0),
      create: vi.fn().mockResolvedValue({
        id: options?.createdId ?? "appt-1",
      }),
    },
  };
  mockDb.$transaction.mockImplementation(async (cb) => cb(tx));
  return tx;
}

function mockDefaultHours() {
  mockDb.businessHours.findMany.mockImplementation(async ({ where }) => {
    if (where.professionalId === "prof-1") return [];
    return [{ id: "h1", startTime: "09:00", endTime: "13:00", isActive: true }];
  });
}

function mockOkEntities() {
  mockDb.service.findFirst.mockResolvedValue({
    id: "svc-1",
    durationMinutes: 30,
    price: 5000,
  });
  mockDb.professional.findFirst.mockImplementation(async (args) => {
    // El segundo findFirst busca el offer de servicio (where.services).
    if (args.where.services) return { id: "prof-1" };
    return { id: "prof-1" };
  });
  mockDb.customer.findFirst.mockResolvedValue({ id: "cust-1" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDefaultHours();
  mockOkEntities();
});

describe("createBooking", () => {
  it("crea el turno correctamente con precio snapshot del servicio", async () => {
    const tx = makeTx();

    const result = await createBooking({
      businessId: "biz-1",
      businessTimezone: BA,
      professionalId: "prof-1",
      serviceId: "svc-1",
      customerId: "cust-1",
      startsAt: new Date("2026-09-14T13:00:00.000Z"), // 10:00 local
    });

    expect(result).toEqual({ id: "appt-1" });
    expect(tx.appointment.create).toHaveBeenCalledTimes(1);
    expect(tx.appointment.create.mock.calls[0][0].data.price).toBe(5000);
    expect(tx.appointment.create.mock.calls[0][0].data.businessId).toBe("biz-1");
  });

  it("rechaza la reserva si hay un turno solapado (doble reserva)", async () => {
    makeTx({ conflict: true });

    const result = await createBooking({
      businessId: "biz-1",
      businessTimezone: BA,
      professionalId: "prof-1",
      serviceId: "svc-1",
      customerId: "cust-1",
      startsAt: new Date("2026-09-14T13:00:00.000Z"),
    });

    expect(result).toMatchObject({ kind: "unavailable" });
  });

  it("convierte la violación del constraint único en horario no disponible", async () => {
    const tx = makeTx();
    tx.appointment.create.mockRejectedValue({ code: "P2002" });

    const result = await createBooking({
      businessId: "biz-1",
      businessTimezone: BA,
      professionalId: "prof-1",
      serviceId: "svc-1",
      customerId: "cust-1",
      startsAt: new Date("2026-09-14T13:00:00.000Z"),
    });

    expect(result).toMatchObject({ kind: "unavailable" });
  });

  it("no crea nada si el servicio no existe o está inactivo", async () => {
    mockDb.service.findFirst.mockResolvedValue(null);
    const result = await createBooking({
      businessId: "biz-1",
      businessTimezone: BA,
      professionalId: "prof-1",
      serviceId: "svc-x",
      customerId: "cust-1",
      startsAt: new Date("2026-09-14T13:00:00.000Z"),
    });
    expect(result).toMatchObject({ kind: "not_found" });
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it("rechaza el profesional que no ofrece el servicio", async () => {
    mockDb.professional.findFirst.mockImplementation(async (args) => {
      if (args.where.services) return null;
      return { id: "prof-1" };
    });
    const result = await createBooking({
      businessId: "biz-1",
      businessTimezone: BA,
      professionalId: "prof-1",
      serviceId: "svc-2",
      customerId: "cust-1",
      startsAt: new Date("2026-09-14T13:00:00.000Z"),
    });
    expect(result).toMatchObject({ kind: "not_offered" });
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it("rechaza el cliente que no pertenece al negocio", async () => {
    mockDb.customer.findFirst.mockResolvedValue(null);
    const result = await createBooking({
      businessId: "biz-1",
      businessTimezone: BA,
      professionalId: "prof-1",
      serviceId: "svc-1",
      customerId: "cust-otro",
      startsAt: new Date("2026-09-14T13:00:00.000Z"),
    });
    expect(result).toMatchObject({ kind: "not_found" });
  });

  it("rechaza un horario fuera de la grilla de atención", async () => {
    mockDb.businessHours.findMany.mockResolvedValue([]);

    const result = await createBooking({
      businessId: "biz-1",
      businessTimezone: BA,
      professionalId: "prof-1",
      serviceId: "svc-1",
      customerId: "cust-1",
      startsAt: new Date("2026-09-14T13:00:00.000Z"),
    });

    expect(result).toMatchObject({ kind: "invalid" });
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it("devuelve unavailable si un BookingConflict escapa de la validación", async () => {
    mockDb.$transaction.mockRejectedValue(new BookingConflict());
    const result = await createBooking({
      businessId: "biz-1",
      businessTimezone: BA,
      professionalId: "prof-1",
      serviceId: "svc-1",
      customerId: "cust-1",
      startsAt: new Date("2026-09-14T13:00:00.000Z"),
    });
    expect(result).toMatchObject({ kind: "unavailable" });
  });

  it("devuelve internal ante errores inesperados", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockDb.$transaction.mockRejectedValue(new Error("boom"));

    const result = await createBooking({
      businessId: "biz-1",
      businessTimezone: BA,
      professionalId: "prof-1",
      serviceId: "svc-1",
      customerId: "cust-1",
      startsAt: new Date("2026-09-14T13:00:00.000Z"),
    });

    expect(result).toMatchObject({ kind: "internal" });
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});