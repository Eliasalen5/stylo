import { describe, it, expect, vi, afterEach } from "vitest";
import {
  buildAppointmentEmail,
  buildBusinessAppointmentEmail,
  sendTransactionalEmail,
} from "@/lib/email";

const BASE = {
  customerName: "Juan",
  businessName: "Peluquería La Moda",
  businessSlug: "la-moda" as string | undefined,
  serviceName: "Corte",
  professionalName: "Ana",
  startsAtLocal: "2026-09-15 10:00",
  endsAtLocal: "10:30",
  bookingUrl: "https://app.example.com/la-moda",
};

describe("buildAppointmentEmail", () => {
  it("genera asunto y cuerpo de confirmación", () => {
    const msg = buildAppointmentEmail({ ...BASE, kind: "CONFIRMED" });
    expect(msg.subject).toContain("confirmado");
    expect(msg.html).toContain("Corte");
    expect(msg.html).toContain("con Ana");
    expect(msg.html).toContain("https://app.example.com/la-moda");
    expect(msg.text).not.toMatch(/<[^>]+>/);
  });

  it("incluye la fecha y hora en el recordatorio", () => {
    const msg = buildAppointmentEmail({ ...BASE, kind: "REMINDER" });
    expect(msg.subject).toContain("Recordatorio");
    expect(msg.html).toContain("10:00");
  });

  it("genera mensaje de cancelación sin horario nuevo", () => {
    const msg = buildAppointmentEmail({ ...BASE, kind: "CANCELLED" });
    expect(msg.subject).toContain("cancelado");
    expect(msg.html).toContain("fue cancelado");
  });
});

describe("buildBusinessAppointmentEmail", () => {
  const BUSINESS_MESSAGE = {
    businessName: "Peluquería La Moda",
    customerName: "Juan",
    serviceName: "Corte",
    professionalName: "Ana",
    startsAtLocal: "2026-09-15 10:00",
    endsAtLocal: "10:30",
    price: 5000,
  };

  it("genera aviso de nueva reserva con cliente y precio formateado", () => {
    const msg = buildBusinessAppointmentEmail({ ...BUSINESS_MESSAGE, kind: "BOOKED" });
    expect(msg.subject).toContain("Nueva reserva");
    expect(msg.html).toContain("Juan");
    expect(msg.html).toContain("$5.000");
    expect(msg.text).not.toMatch(/<[^>]+>/);
  });

  it("genera aviso de cancelación", () => {
    const msg = buildBusinessAppointmentEmail({ ...BUSINESS_MESSAGE, kind: "CANCELLED" });
    expect(msg.subject).toContain("cancelada");
    expect(msg.html).toContain("fue cancelado");
  });

  it("genera aviso de reprogramación", () => {
    const msg = buildBusinessAppointmentEmail({ ...BUSINESS_MESSAGE, kind: "RESCHEDULED" });
    expect(msg.subject).toContain("reprogramada");
  });
});

describe("sendTransactionalEmail", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("en desarrollo sin RESEND_API_KEY simula el envío sin fallar", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const ok = await sendTransactionalEmail({
      to: "juan@example.com",
      subject: "Turno confirmado",
      text: "texto",
      html: "<p>html</p>",
    });

    expect(ok).toBe(true);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("[email:simulado]"));
  });
});