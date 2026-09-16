import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Token firmado (HMAC-SHA256, sin estado) que permite a un cliente gestionar
 * UN turno específico sin autenticación. Se envía por email (confirmación y
 * recordatorio) y otorga el mínimo alcance: un solo turno, de su propia reserva.
 *
 * Formato: base64url(payload) + "." + base64url(signature)
 * Payload: { v: 1, a: appointmentId, c: customerId, exp: epochSeconds }
 *
 * - Sin migraciones ni almacenamiento.
 * - Caduca (por defecto 7 días).
 * - Si falta APPOINTMENT_TOKEN_SECRET => fracaso cerrado (no se firma nada).
 */

export const APPOINTMENT_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type TokenPayload = {
  v: 1;
  a: string;
  c: string;
  exp: number;
};

function base64UrlEncode(data: Buffer | string): string {
  return Buffer.from(data)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(input: string): Buffer {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(b64, "base64");
}

function currentSecret(): string | null {
  const secret = process.env.APPOINTMENT_TOKEN_SECRET;
  return secret && secret.length > 0 ? secret : null;
}

/**
 * Firma un token de gestión para el turno y su cliente.
 * Devuelve null si APPOINTMENT_TOKEN_SECRET no está configurado.
 */
export function signAppointmentToken(
  appointmentId: string,
  customerId: string,
  now = new Date()
): string | null {
  const secret = currentSecret();
  if (!secret) return null;

  const exp = Math.floor(now.getTime() / 1000) + APPOINTMENT_TOKEN_TTL_MS / 1000;
  const payload: TokenPayload = { v: 1, a: appointmentId, c: customerId, exp };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  const signature = createHmac("sha256", secret).update(encoded).digest();

  return `${encoded}.${base64UrlEncode(signature)}`;
}

/**
 * Verifica la firma, integridad y expiración del token.
 * Devuelve null si el token es inválido, fue alterado, está vencido o la
 * secret no está configurada (fail-closed).
 */
export function verifyAppointmentToken(
  token: string
): { appointmentId: string; customerId: string } | null {
  const secret = currentSecret();
  if (!secret) return null;

  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

  const [encoded, signatureB64] = parts;

  let payload: unknown;
  try {
    payload = JSON.parse(base64UrlDecode(encoded).toString("utf8"));
  } catch {
    return null;
  }

  if (typeof payload !== "object" || payload === null) return null;
  const { v, a, c, exp } = payload as {
    v?: unknown;
    a?: unknown;
    c?: unknown;
    exp?: unknown;
  };

  if (v !== 1 || typeof a !== "string" || typeof c !== "string" || typeof exp !== "number") {
    return null;
  }

  const expected = createHmac("sha256", secret).update(encoded).digest();
  const given = base64UrlDecode(signatureB64);

  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return null;
  }

  if (exp * 1000 < Date.now()) return null;

  return { appointmentId: a, customerId: c };
}

/**
 * URL pública de gestión del turno (a partir del token), usada en los emails
 * de confirmación y recordatorio que recibe el cliente.
 */
export function appointmentManageUrl(businessSlug: string, token: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${appUrl}/${businessSlug}/turno/${token}`;
}