import { describe, it, expect, vi, afterEach } from "vitest";
import {
  buildAppointmentEmail,
  buildBusinessAppointmentEmail,
  sendTransactionalEmail,
} from "@/lib/email";

const mockSend = vi.hoisted(() => vi.fn());

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: mockSend };
  },
}));

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

  it("incluye el link de gestión del turno cuando se pasa manageUrl", () => {
    const msg = buildAppointmentEmail({
      ...BASE,
      kind: "CONFIRMED",
      manageUrl: "https://app.example.com/la-moda/turno/tok123",
    });
    expect(msg.html).toContain("Gestionar o cancelar turno");
    expect(msg.html).toContain("/la-moda/turno/tok123");
    expect(msg.text).toContain("Gestión de tu turno");
    expect(msg.text).toContain("/la-moda/turno/tok123");
  });

  it("escapa contenido HTML de los datos del cliente", () => {
    const msg = buildAppointmentEmail({
      ...BASE,
      kind: "CONFIRMED",
      customerName: "<script>alert(1)</script>",
      businessName: 'Barbería "El Cucho"',
    });

    expect(msg.html).not.toContain("<script>");
    expect(msg.html).toContain("&lt;script&gt;");
    expect(msg.html).toContain("&quot;El Cucho&quot;");
    expect(msg.text).toContain("<script>alert(1)</script>");
    expect(msg.text).toContain("Barbería \"El Cucho\"");
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
    vi.resetModules();
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
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

  it("devuelve false cuando Resend responde con error (no lanza)", async () => {
    vi.resetModules();
    process.env.RESEND_API_KEY = "test-key";
    process.env.EMAIL_FROM = "Stylo <no-reply@stylo.app>";
    mockSend.mockResolvedValue({
      data: null,
      error: { name: "application_error", message: "the from field is invalid" },
    });

    const { sendTransactionalEmail: send } = await import("@/lib/email");
    const ok = await send({
      to: "juan@example.com",
      subject: "Turno confirmado",
      text: "texto",
      html: "<p>html</p>",
    });

    expect(ok).toBe(false);
  });

  it("devuelve true cuando Resend responde con data", async () => {
    vi.resetModules();
    process.env.RESEND_API_KEY = "test-key";
    process.env.EMAIL_FROM = "Stylo <no-reply@stylo.app>";
    mockSend.mockResolvedValue({
      data: { id: "email-id-1" },
      error: null,
    });

    const { sendTransactionalEmail: send } = await import("@/lib/email");
    const ok = await send({
      to: "juan@example.com",
      subject: "Turno confirmado",
      text: "texto",
      html: "<p>html</p>",
    });

    expect(ok).toBe(true);
  });
});