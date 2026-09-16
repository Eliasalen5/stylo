import { beforeEach, describe, it, expect, vi } from "vitest";
import {
  signAppointmentToken,
  verifyAppointmentToken,
  appointmentManageUrl,
  APPOINTMENT_TOKEN_TTL_MS,
} from "@/lib/appointment-token";

const SECRET = "test-secret-123";

beforeEach(() => {
  vi.stubEnv("APPOINTMENT_TOKEN_SECRET", SECRET);
});

describe("appointment token", () => {
  it("firma y verifica un token válido", () => {
    const now = new Date("2026-09-16T12:00:00.000Z");
    const token = signAppointmentToken("appt-1", "cust-1", now);

    expect(token).toBeTruthy();
    expect(verifyAppointmentToken(token!)).toEqual({
      appointmentId: "appt-1",
      customerId: "cust-1",
    });
  });

  it("rechaza un token alterado (payload manipulado)", () => {
    const token = signAppointmentToken("appt-1", "cust-1", new Date())!;

    const [encoded, signature] = token.split(".");
    const tamperedEncoded = encoded.replace(/^.{1}/, encoded[0] === "A" ? "B" : "A");

    expect(verifyAppointmentToken(`${tamperedEncoded}.${signature}`)).toBeNull();
  });

  it("rechaza una firma con clave distinta", () => {
    const token = signAppointmentToken("appt-1", "cust-1", new Date())!;

    vi.stubEnv("APPOINTMENT_TOKEN_SECRET", "otra-secret");
    expect(verifyAppointmentToken(token)).toBeNull();
  });

  it("rechaza un token expirado", () => {
    const now = new Date();
    const token = signAppointmentToken("appt-1", "cust-1", now)!;
    const expiredPayload = Buffer.from(
      JSON.stringify({
        v: 1,
        a: "appt-1",
        c: "cust-1",
        exp: Math.floor(now.getTime() / 1000) + APPOINTMENT_TOKEN_TTL_MS / 1000 - 1,
      })
    )
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    expect(verifyAppointmentToken(`${expiredPayload}.${token.split(".")[1]}`)).toBeNull();
  });

  it("devuelve null para formatos inválidos", () => {
    expect(verifyAppointmentToken("")).toBeNull();
    expect(verifyAppointmentToken("solo-un-segmento")).toBeNull();
    expect(verifyAppointmentToken("a.b.c")).toBeNull();
  });

  it("falla cerrado cuando no hay secret configurada", () => {
    vi.stubEnv("APPOINTMENT_TOKEN_SECRET", "");

    expect(signAppointmentToken("appt-1", "cust-1")).toBeNull();
    const token = signAppointmentToken("appt-1", "cust-1");
    expect(token).toBeNull();
    // No se puede verificar nada sin secret, aunque el token parezca válido.
    expect(verifyAppointmentToken("firmado.antes")).toBeNull();
  });

  it("construye la URL pública de gestión", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://stylo.example");
    expect(appointmentManageUrl("kbrones", "tok123")).toBe(
      "https://stylo.example/kbrones/turno/tok123"
    );
  });
});