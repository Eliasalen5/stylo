import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
  appointment: { findFirst: vi.fn() },
  business: { findFirst: vi.fn() },
  businessMember: { findMany: vi.fn() },
  user: { findUnique: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

vi.mock("@/lib/email", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/email")>();
  return {
    ...original,
    sendTransactionalEmail: vi.fn().mockResolvedValue(true),
  };
});

import { notifyBusinessAppointmentEvent } from "@/lib/appointment-emails";
import { sendTransactionalEmail } from "@/lib/email";

const TIMEZONE = "America/Argentina/Buenos_Aires";

function appointmentFixture(options: {
  professionalEmail?: string | null;
  professionalUserId?: string | null;
} = {}) {
  return {
    id: "appt-1",
    businessId: "biz-1",
    startsAt: new Date("2026-09-15T13:00:00.000Z"),
    endsAt: new Date("2026-09-15T13:30:00.000Z"),
    price: 5000,
    customer: { name: "Juan" },
    service: { name: "Corte" },
    professional: {
      name: "Ana",
      email: options.professionalEmail === undefined ? "ana@estudio.com" : options.professionalEmail,
      userId: options.professionalUserId === undefined ? null : options.professionalUserId,
    },
    business: { name: "Kbrones", timezone: TIMEZONE },
  };
}

function sentTo(): string[] {
  return (sendTransactionalEmail as unknown as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0].to);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.appointment.findFirst.mockResolvedValue(appointmentFixture());
  mockDb.businessMember.findMany.mockResolvedValue([{ user: { email: "dono@kbrones.com" } }]);
  mockDb.business.findFirst.mockResolvedValue({ email: null });
  mockDb.user.findUnique.mockResolvedValue(null);
});

describe("notifyBusinessAppointmentEvent", () => {
  it("avisa al dueño y al profesional por separado", async () => {
    await notifyBusinessAppointmentEvent({
      businessId: "biz-1",
      appointmentId: "appt-1",
      kind: "BOOKED",
    });

    expect(sendTransactionalEmail).toHaveBeenCalledTimes(2);
    expect(sentTo()).toEqual(expect.arrayContaining(["dono@kbrones.com", "ana@estudio.com"]));
  });

  it("deduplica cuando dueño y profesional comparten email", async () => {
    mockDb.businessMember.findMany.mockResolvedValue([{ user: { email: "ana@estudio.com" } }]);

    await notifyBusinessAppointmentEvent({
      businessId: "biz-1",
      appointmentId: "appt-1",
      kind: "BOOKED",
    });

    expect(sendTransactionalEmail).toHaveBeenCalledTimes(1);
    expect(sentTo()).toEqual(["ana@estudio.com"]);
  });

  it("usa el email de la cuenta del profesional si no tiene email directo", async () => {
    mockDb.appointment.findFirst.mockResolvedValue(
      appointmentFixture({ professionalEmail: null, professionalUserId: "user-9" })
    );
    mockDb.user.findUnique.mockResolvedValue({ email: "ana-cuenta@estudio.com" });

    await notifyBusinessAppointmentEvent({
      businessId: "biz-1",
      appointmentId: "appt-1",
      kind: "RESCHEDULED",
    });

    expect(sentTo()).toEqual(expect.arrayContaining(["ana-cuenta@estudio.com"]));
  });

  it("no envía nada si no hay destinatarios posibles", async () => {
    mockDb.businessMember.findMany.mockResolvedValue([]);
    mockDb.business.findFirst.mockResolvedValue({ email: null });
    mockDb.appointment.findFirst.mockResolvedValue(
      appointmentFixture({ professionalEmail: null, professionalUserId: null })
    );

    await notifyBusinessAppointmentEvent({
      businessId: "biz-1",
      appointmentId: "appt-1",
      kind: "BOOKED",
    });

    expect(sendTransactionalEmail).not.toHaveBeenCalled();
  });

  it("no hace nada si el turno no pertenece al business (tenant)", async () => {
    mockDb.appointment.findFirst.mockResolvedValue(null);

    await notifyBusinessAppointmentEvent({
      businessId: "biz-1",
      appointmentId: "appt-ajeno",
      kind: "BOOKED",
    });

    expect(sendTransactionalEmail).not.toHaveBeenCalled();
  });
});