import { beforeEach, describe, it, expect, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
  appointment: { findMany: vi.fn() },
  reminder: {
    upsert: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

const mockEmail = vi.hoisted(() => ({
  sendTransactionalEmail: vi.fn(),
  buildAppointmentEmail: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/email", () => mockEmail);

import {
  scheduleUpcomingReminders,
  processDueReminders,
  deletePendingRemindersForAppointment,
  REMINDER_WINDOW_HOURS,
} from "@/lib/reminders";

const NOW = new Date("2026-09-14T12:00:00.000Z");

function makeAppointment(startsAt: Date) {
  return {
    id: "a1",
    businessId: "b1",
    customerId: "c1",
    startsAt,
  };
}

function makeDueReminder(overrides?: { email?: string | null }) {
  return {
    id: "r1",
    customer: {
      name: "Juan",
      email: overrides?.email === undefined ? "juan@example.com" : overrides.email,
    },
    appointment: {
      startsAt: new Date(NOW.getTime() + 2 * 60 * 60 * 1000),
      endsAt: new Date(NOW.getTime() + 2.5 * 60 * 60 * 1000),
      service: { name: "Corte" },
      professional: { name: "Ana" },
      business: { name: "Pelu", slug: "pelu", timezone: "America/Argentina/Buenos_Aires" },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockEmail.buildAppointmentEmail.mockReturnValue({
    subject: "Recordatorio: Corte",
    text: "texto",
    html: "<html/>",
  });
});

describe("scheduleUpcomingReminders", () => {
  it("programa un Reminder PENDING 24 hs antes del turno", async () => {
    const startsAt = new Date(NOW.getTime() + 10 * 60 * 60 * 1000);
    mockDb.appointment.findMany.mockResolvedValue([makeAppointment(startsAt)]);
    mockDb.reminder.upsert.mockResolvedValue({ id: "r1", status: "PENDING" });

    const result = await scheduleUpcomingReminders(NOW);

    expect(result).toBe(1);
    expect(mockDb.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: "CONFIRMED",
          startsAt: { gt: NOW, lte: expect.any(Date) },
          customer: { email: { not: null } },
        },
      })
    );

    const expectedScheduledAt = new Date(startsAt.getTime() - REMINDER_WINDOW_HOURS * 60 * 60 * 1000);
    expect(mockDb.reminder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          appointmentId_channel_scheduledAt: {
            appointmentId: "a1",
            channel: "EMAIL",
            scheduledAt: expectedScheduledAt,
          },
        },
        create: expect.objectContaining({
          appointmentId: "a1",
          channel: "EMAIL",
          status: "PENDING",
          scheduledAt: expectedScheduledAt,
        }),
      })
    );
  });

  it("no cuenta dos veces un recordatorio ya programado (idempotencia)", async () => {
    const startsAt = new Date(NOW.getTime() + 5 * 60 * 60 * 1000);
    mockDb.appointment.findMany.mockResolvedValue([makeAppointment(startsAt)]);
    // El upsert en modo "existe" (update: {}) devuelve el PENDING ya creado.
    mockDb.reminder.upsert.mockResolvedValue({ id: "r1", status: "PENDING" });

    await scheduleUpcomingReminders(NOW);
    await scheduleUpcomingReminders(NOW);

    // No duplica filas: mismo where exacto en ambas corridas.
    expect(mockDb.reminder.upsert).toHaveBeenCalledTimes(2);
    const calls = mockDb.reminder.upsert.mock.calls.map((c) => c[0].where);
    expect(calls[0]).toEqual(calls[1]);
  });

  it("no programa turnos fuera de la ventana", async () => {
    mockDb.appointment.findMany.mockResolvedValue([]);
    const result = await scheduleUpcomingReminders(NOW);
    expect(result).toBe(0);
    expect(mockDb.reminder.upsert).not.toHaveBeenCalled();
  });
});

describe("processDueReminders", () => {
  beforeEach(() => {
    mockEmail.sendTransactionalEmail.mockResolvedValue(true);
    mockDb.reminder.update.mockResolvedValue({});
  });

  it("envía el email y marca el Reminder como SENT", async () => {
    mockDb.reminder.findMany.mockResolvedValue([makeDueReminder()]);

    const result = await processDueReminders(NOW);

    expect(result).toEqual({ sent: 1, failed: 0 });
    expect(mockEmail.sendTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "juan@example.com",
        subject: "Recordatorio: Corte",
      })
    );
    expect(mockDb.reminder.update).toHaveBeenCalledWith({
      where: { id: "r1" },
      data: { status: "SENT", sentAt: NOW },
    });
  });

  it("marca FAILED cuando el email no puede enviarse", async () => {
    mockDb.reminder.findMany.mockResolvedValue([makeDueReminder()]);
    mockEmail.sendTransactionalEmail.mockResolvedValue(false);

    const result = await processDueReminders(NOW);

    expect(result).toEqual({ sent: 0, failed: 1 });
    expect(mockDb.reminder.update).toHaveBeenCalledWith({
      where: { id: "r1" },
      data: { status: "FAILED", failedAt: NOW, error: "send_failed" },
    });
  });

  it("marca FAILED sin intentar enviar cuando el cliente no tiene email", async () => {
    mockDb.reminder.findMany.mockResolvedValue([makeDueReminder({ email: null })]);

    const result = await processDueReminders(NOW);

    expect(result).toEqual({ sent: 0, failed: 1 });
    expect(mockEmail.sendTransactionalEmail).not.toHaveBeenCalled();
    expect(mockDb.reminder.update).toHaveBeenCalledWith({
      where: { id: "r1" },
      data: { status: "FAILED", failedAt: NOW, error: "missing_email" },
    });
  });
});

describe("deletePendingRemindersForAppointment", () => {
  it("borra solo los recordatorios pendientes del turno", async () => {
    mockDb.reminder.deleteMany.mockResolvedValue({ count: 2 });

    await deletePendingRemindersForAppointment("a1");

    expect(mockDb.reminder.deleteMany).toHaveBeenCalledWith({
      where: { appointmentId: "a1", status: "PENDING" },
    });
  });
});