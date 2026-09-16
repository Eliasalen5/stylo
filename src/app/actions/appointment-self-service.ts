"use server";

import { redirect } from "next/navigation";
import {
  cancelAppointmentByToken,
  rescheduleAppointmentByToken,
} from "@/lib/appointment-self-service";

/**
 * Autoservicio público del cliente. No hay sesión: el token firmado recibido
 * por email es la credencial. La validación completa es server-side en
 * appointment-self-service.ts (firma, expiración, tenant y disponibilidad).
 */

export type PortalActionState = {
  error?: string;
  fieldErrors?: { time?: string };
};

function readFields(formData: FormData): {
  token: string;
  slug: string;
  startsAt?: string;
} {
  return {
    token: formData.get("token")?.toString().trim() ?? "",
    slug: formData.get("slug")?.toString().trim() ?? "",
    startsAt: formData.get("startsAt")?.toString().trim() ?? undefined,
  };
}

export async function cancelAppointmentByTokenAction(
  _prev: PortalActionState,
  formData: FormData
): Promise<PortalActionState> {
  const { token, slug } = readFields(formData);

  if (!token || !slug) return { error: "Link inválido." };

  const result = await cancelAppointmentByToken(token);

  if ("error" in result) return { error: result.error };

  redirect(`/${slug}/turno/${token}`);
}

export async function rescheduleAppointmentByTokenAction(
  _prev: PortalActionState,
  formData: FormData
): Promise<PortalActionState> {
  const { token, slug, startsAt } = readFields(formData);

  if (!token || !slug) return { error: "Link inválido." };
  if (!startsAt) return { fieldErrors: { time: "Elegí un nuevo horario." } };

  const result = await rescheduleAppointmentByToken(token, startsAt);

  if ("error" in result) return { error: result.error };

  redirect(`/${slug}/turno/${token}`);
}