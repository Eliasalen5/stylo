import { beforeEach, describe, it, expect, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
  appointment: { findFirst: vi.fn(), update: vi.fn() },
}));

const mockToken = vi.hoisted(() => ({ verifyAppointmentToken: vi.fn() }));
const mockAvailability = vi.hoisted(() => ({ isBookableSlot: vi.fn() }));
const mockBooking = vi.hoisted(() => ({
  runBookingTransaction: vi.fn(),
  BookingConflict: class BookingConflict extends Error {},
}));
const mockEmails = vi.hoisted(() => ({
  notifyAppointmentEvent: vi.fn(),
  notifyBusinessAppointmentEvent: vi.fn(),
}));
const mockReminders = vi.hoisted(() => ({
  deletePendingRemindersForAppointment: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/appointment-token", () => mockToken);
vi.mock("@/lib/availability", () => mockAvailability);
vi.mock("@/lib/booking", () => mockBooking);
vi.mock("@/lib/appointment-emails", () => mockEmails);
vi.mock("@/lib/reminders", () => mockReminders);

import {
  getAppointmentForPortal,
  cancelAppointmentByToken,
  rescheduleAppointmentByToken,
} from "@/lib/appointment-self-service";

const NOW = new Date("2026-09-16T12:00:00.000Z");

const VALID_TOKEN = "valid.token";

function makeAppointment(overrides?: Record<string, unknown>) {
  return {
    id: "appt-1",
    businessId: "biz-1",
    professionalId: "prof-1",
    status: "CONFIRMED",
    startsAt: new Date("2026-09-17T13:00:00.000Z"),
    endsAt: new Date("2026-09-17T13:30:00.000Z"),
    customer: { name: "Juan" },
    service: { name: "Corte", durationMinutes: 30, isActive: true },
    professional: { name: "Ana", isActive: true },
    business: { name: "Pelu", slug: "pelu", timezone: "America/Argentina/Buenos_Aires" },
    ...overrides,
  };
}

function mockValidToken() {
  mockToken.verifyAppointmentToken.mockReturnValue({
    appointmentId: "appt-1",
    customerId: "cust-1",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockValidToken();
  mockAvailability.isBookableSlot.mockResolvedValue(true);
  mockDb.appointment.findFirst.mockResolvedValue(makeAppointment());
});

describe("getAppointmentForPortal", () => {
  it("rechaza un token inválido sin consultar la DB", async () => {
    mockToken.verifyAppointmentToken.mockReturnValue(null);

    const result = await getAppointmentForPortal("mal.token");

    expect(result).toMatchObject({ kind: "invalid" });
    expect(mockDb.appointment.findFirst).not.toHaveBeenCalled();
  });

  it("devuelve el turno del cliente cuando el token es válido", async () => {
    const result = await getAppointmentForPortal(VALID_TOKEN);

    expect(result).toEqual({ appointment: expect.objectContaining({ id: "appt-1" }) });
    expect(mockDb.appointment.findFirst).toHaveBeenCalledWith({
      where: { id: "appt-1", customerId: "cust-1" },
      include: expect.any(Object),
    });
  });

  it("scopes la búsqueda: solo el turno firmado por su customerId", async () => {
    await getAppointmentForPortal(VALID_TOKEN);

    const where = mockDb.appointment.findFirst.mock.calls[0][0].where;
    expect(where).toEqual({ id: "appt-1", customerId: "cust-1" });
  });
});

describe("cancelAppointmentByToken", () => {
  it("cancela el turno y notifica a cliente y negocio", async () => {
    mockDb.appointment.update.mockResolvedValue({ id: "appt-1" });

    const result = await cancelAppointmentByToken(VALID_TOKEN, NOW);

    expect(result).toEqual({ ok: true });
    expect(mockDb.appointment.update).toHaveBeenCalledWith({
      where: { id: "appt-1" },
      data: { status: "CANCELLED" },
    });
    expect(mockReminders.deletePendingRemindersForAppointment).toHaveBeenCalledWith("appt-1");
    expect(mockEmails.notifyAppointmentEvent).toHaveBeenCalledWith({
      businessId: "biz-1",
      appointmentId: "appt-1",
      kind: "CANCELLED",
    });
    expect(mockEmails.notifyBusinessAppointmentEvent).toHaveBeenCalledWith({
      businessId: "biz-1",
      appointmentId: "appt-1",
      kind: "CANCELLED",
    });
  });

  it("no cancela un turno ya finalizado", async () => {
    let called = false;
    mockDb.appointment.update.mockImplementation(() => {
      called = true;
      return Promise.resolve({});
    });

    mockDb.appointment.findFirst.mockResolvedValue(
      makeAppointment({ status: "COMPLETED" })
    );

    const result = await cancelAppointmentByToken(VALID_TOKEN, NOW);

    expect(result).toMatchObject({ kind: "forbidden" });
    expect(called).toBe(false);
  });

  it("no cancela un turno que ya comenzó", async () => {
    mockDb.appointment.findFirst.mockResolvedValue(
      makeAppointment({ startsAt: new Date("2026-09-16T10:00:00.000Z") })
    );

    const result = await cancelAppointmentByToken(VALID_TOKEN, NOW);

    expect(result).toMatchObject({ kind: "forbidden" });
    expect(mockDb.appointment.update).not.toHaveBeenCalled();
  });

  it("rechaza token inválido y turno inexistente", async () => {
    mockToken.verifyAppointmentToken.mockReturnValue(null);
    expect(await cancelAppointmentByToken("x", NOW)).toMatchObject({ kind: "invalid" });

    mockValidToken();
    mockDb.appointment.findFirst.mockResolvedValue(null);
    expect(await cancelAppointmentByToken(VALID_TOKEN, NOW)).toMatchObject({ kind: "not_found" });
  });
});

describe("rescheduleAppointmentByToken", () => {
  function mockTransaction() {
    const tx = { appointment: { update: vi.fn().mockResolvedValue({}) } };
    mockBooking.runBookingTransaction.mockImplementation(async (_p, _s, _e, cb) => cb(tx));
    return tx;
  }

  it("reprograma dentro de la transacción anti doble reserva y notifica", async () => {
    const tx = mockTransaction();
    const newStartsAt = new Date("2026-09-18T15:00:00.000Z");

    const result = await rescheduleAppointmentByToken(
      VALID_TOKEN,
      newStartsAt.toISOString(),
      NOW
    );

    expect(result).toEqual({ ok: true });
    expect(tx.appointment.update).toHaveBeenCalledWith({
      where: { id: "appt-1" },
      data: { startsAt: newStartsAt, endsAt: new Date("2026-09-18T15:30:00.000Z") },
    });
    expect(mockAvailability.isBookableSlot).toHaveBeenCalledWith(
      expect.objectContaining({
        businessId: "biz-1",
        professionalId: "prof-1",
        durationMinutes: 30,
        startsAt: newStartsAt,
      })
    );
    expect(mockEmails.notifyAppointmentEvent).toHaveBeenCalledWith({
      businessId: "biz-1",
      appointmentId: "appt-1",
      kind: "RESCHEDULED",
    });
    expect(mockEmails.notifyBusinessAppointmentEvent).toHaveBeenCalledWith({
      businessId: "biz-1",
      appointmentId: "appt-1",
      kind: "RESCHEDULED",
    });
    expect(mockReminders.deletePendingRemindersForAppointment).toHaveBeenCalledWith("appt-1");
  });

  it("rechaza un horario fuera de la grilla", async () => {
    mockAvailability.isBookableSlot.mockResolvedValue(false);

    const result = await rescheduleAppointmentByToken(
      VALID_TOKEN,
      "2026-09-18T15:00:00.000Z",
      NOW
    );

    expect(result).toMatchObject({ kind: "invalid" });
    expect(mockBooking.runBookingTransaction).not.toHaveBeenCalled();
  });

  it("convierte un conflicto de doble reserva en horario no disponible", async () => {
    mockBooking.runBookingTransaction.mockRejectedValue(new mockBooking.BookingConflict());

    const result = await rescheduleAppointmentByToken(
      VALID_TOKEN,
      "2026-09-18T15:00:00.000Z",
      NOW
    );

    expect(result).toMatchObject({ kind: "unavailable" });
  });

  it("rechaza reprogramar un turno cancelado", async () => {
    mockDb.appointment.findFirst.mockResolvedValue(makeAppointment({ status: "CANCELLED" }));

    const result = await rescheduleAppointmentByToken(
      VALID_TOKEN,
      "2026-09-18T15:00:00.000Z",
      NOW
    );

    expect(result).toMatchObject({ kind: "forbidden" });
    expect(mockBooking.runBookingTransaction).not.toHaveBeenCalled();
  });

  it("rechaza reprogramar si el servicio o profesional quedó inactivo", async () => {
    mockDb.appointment.findFirst.mockResolvedValue(
      makeAppointment({ service: { name: "Corte", durationMinutes: 30, isActive: false } })
    );

    const result = await rescheduleAppointmentByToken(
      VALID_TOKEN,
      "2026-09-18T15:00:00.000Z",
      NOW
    );

    expect(result).toMatchObject({ kind: "unavailable" });
    expect(mockBooking.runBookingTransaction).not.toHaveBeenCalled();
  });

  it("rechaza fecha inválida y token inválido", async () => {
    const bad = await rescheduleAppointmentByToken(VALID_TOKEN, "no-es-fecha", NOW);
    expect(bad).toMatchObject({ kind: "invalid" });
    expect(mockBooking.runBookingTransaction).not.toHaveBeenCalled();

    mockToken.verifyAppointmentToken.mockReturnValue(null);
    expect(await rescheduleAppointmentByToken("x", "2026-09-18T15:00:00.000Z", NOW)).toMatchObject({
      kind: "invalid",
    });
  });
});