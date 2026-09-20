import { beforeEach, describe, it, expect, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
  appointment: { findMany: vi.fn() },
  reminder: {
    create: vi.fn(),
    updateMany: vi.fn(),
    findMany: vi.fn(),
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

function makeDueReminder(overrides?: {
  email?: string | null;
  customerId?: string;
  status?: "PENDING" | "PROCESSING";
}) {
  return {
    id: "r1",
    customerId: overrides?.customerId ?? "c1",
    appointmentId: "a1",
    status: overrides?.status ?? "PENDING",
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
  // Por defecto los claims ganan: una sola corrida activa.
  mockDb.reminder.updateMany.mockResolvedValue({ count: 1 });
});

describe("scheduleUpcomingReminders", () => {
  it("programa un Reminder PENDING 24 hs antes del turno", async () => {
    const startsAt = new Date(NOW.getTime() + 10 * 60 * 60 * 1000);
    mockDb.appointment.findMany.mockResolvedValue([makeAppointment(startsAt)]);
    mockDb.reminder.create.mockResolvedValue({ id: "r1", status: "PENDING" });

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
    expect(mockDb.reminder.create).toHaveBeenCalledWith({
      data: {
        businessId: "b1",
        appointmentId: "a1",
        customerId: "c1",
        channel: "EMAIL",
        status: "PENDING",
        scheduledAt: expectedScheduledAt,
      },
    });
  });

  it("no cuenta dos veces un recordatorio ya programado (idempotencia)", async () => {
    const startsAt = new Date(NOW.getTime() + 5 * 60 * 60 * 1000);
    mockDb.appointment.findMany.mockResolvedValue([makeAppointment(startsAt)]);
    // El primer run crea; el segundo choca contra el unique constraint.
    mockDb.reminder.create
      .mockResolvedValueOnce({ id: "r1", status: "PENDING" })
      .mockRejectedValueOnce(Object.assign(new Error("unique"), { code: "P2002" }));

    const first = await scheduleUpcomingReminders(NOW);
    const second = await scheduleUpcomingReminders(NOW);

    expect(first).toBe(1);
    expect(second).toBe(0);
    expect(mockDb.reminder.create).toHaveBeenCalledTimes(2);
  });

  it("reactiva recordatorios FAILED solo si el turno sigue confirmado y futuro", async () => {
    const startsAt = new Date(NOW.getTime() + 5 * 60 * 60 * 1000);
    mockDb.appointment.findMany.mockResolvedValue([makeAppointment(startsAt)]);
    // Ya existe la fila (FAILED recién reactivada): el create choca.
    mockDb.reminder.create.mockRejectedValueOnce(
      Object.assign(new Error("unique"), { code: "P2002" })
    );

    await scheduleUpcomingReminders(NOW);

    expect(mockDb.reminder.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          appointmentId: "a1",
          channel: "EMAIL",
          status: "FAILED",
          appointment: { status: "CONFIRMED", startsAt: { gt: NOW } },
        }),
        data: { status: "PENDING" },
      })
    );
  });

  it("no programa turnos fuera de la ventana", async () => {
    mockDb.appointment.findMany.mockResolvedValue([]);
    const result = await scheduleUpcomingReminders(NOW);
    expect(result).toBe(0);
    expect(mockDb.reminder.create).not.toHaveBeenCalled();
    expect(mockDb.reminder.updateMany).not.toHaveBeenCalled();
  });
});

describe("processDueReminders", () => {
  beforeEach(() => {
    mockEmail.sendTransactionalEmail.mockResolvedValue(true);
  });

  it("reclama, envía el email y marca el Reminder como SENT", async () => {
    mockDb.reminder.findMany.mockResolvedValue([makeDueReminder()]);

    const result = await processDueReminders(NOW);

    expect(result).toEqual({ sent: 1, failed: 0 });
    expect(mockDb.reminder.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: "r1", status: { in: ["PENDING", "PROCESSING"] } },
        data: { status: "PROCESSING" },
      })
    );
    expect(mockEmail.sendTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "juan@example.com",
        subject: "Recordatorio: Corte",
      })
    );
    expect(mockDb.reminder.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: "r1", status: "PROCESSING" },
        data: { status: "SENT", sentAt: NOW },
      })
    );
  });

  it("no reenvía un reminder que otra corrida ya reclamó", async () => {
    mockDb.reminder.findMany.mockResolvedValue([makeDueReminder()]);
    // El claim falla: otra corrida concurrente ganó esa fila.
    mockDb.reminder.updateMany.mockResolvedValue({ count: 0 });

    const result = await processDueReminders(NOW);

    expect(result).toEqual({ sent: 0, failed: 0 });
    expect(mockEmail.sendTransactionalEmail).not.toHaveBeenCalled();
    expect(mockDb.reminder.updateMany).toHaveBeenCalledTimes(1);
  });

  it("marca FAILED cuando el email no puede enviarse", async () => {
    mockDb.reminder.findMany.mockResolvedValue([makeDueReminder()]);
    mockEmail.sendTransactionalEmail.mockResolvedValue(false);

    const result = await processDueReminders(NOW);

    expect(result).toEqual({ sent: 0, failed: 1 });
    expect(mockDb.reminder.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: "r1", status: "PROCESSING" },
        data: { status: "FAILED", failedAt: NOW, error: "send_failed" },
      })
    );
  });

  it("marca FAILED sin intentar enviar cuando el cliente no tiene email", async () => {
    mockDb.reminder.findMany.mockResolvedValue([makeDueReminder({ email: null })]);

    const result = await processDueReminders(NOW);

    expect(result).toEqual({ sent: 0, failed: 1 });
    expect(mockEmail.sendTransactionalEmail).not.toHaveBeenCalled();
    expect(mockDb.reminder.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: "r1", status: "PROCESSING" },
        data: { status: "FAILED", failedAt: NOW, error: "missing_email" },
      })
    );
  });

  it("recupera reminders PROCESSING colgados por más del umbral", async () => {
    mockDb.reminder.findMany.mockResolvedValue([
      makeDueReminder({ status: "PROCESSING" }),
    ]);

    const result = await processDueReminders(NOW);

    expect(result).toEqual({ sent: 1, failed: 0 });
    // Busca PROCESSING viejos además de PENDING vencidos.
    expect(mockDb.reminder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ status: "PROCESSING" }),
          ]),
        }),
      })
    );
    expect(mockEmail.sendTransactionalEmail).toHaveBeenCalledTimes(1);
  });

  it("incluye el link de gestión del turno en el recordatorio", async () => {
    vi.stubEnv("APPOINTMENT_TOKEN_SECRET", "secret-test");
    mockDb.reminder.findMany.mockResolvedValue([makeDueReminder()]);

    await processDueReminders(NOW);

    expect(mockEmail.buildAppointmentEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "REMINDER",
        manageUrl: expect.stringContaining("/pelu/turno/"),
      })
    );
    vi.unstubAllEnvs();
  });
});

describe("deletePendingRemindersForAppointment", () => {
  it("borra solo los recordatorios pendientes o en proceso del turno", async () => {
    mockDb.reminder.deleteMany.mockResolvedValue({ count: 2 });

    await deletePendingRemindersForAppointment("a1");

    expect(mockDb.reminder.deleteMany).toHaveBeenCalledWith({
      where: { appointmentId: "a1", status: { in: ["PENDING", "PROCESSING"] } },
    });
  });
});