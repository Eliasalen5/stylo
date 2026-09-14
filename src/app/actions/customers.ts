"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { requireCurrentBusiness } from "@/lib/current-business";

/**
 * Busca o crea un cliente por email dentro de un negocio.
 * Si ya existe un Customer con ese email en el negocio, lo reutiliza.
 * Si no, crea uno nuevo.
 *
 * Si el usuario autenticado tiene cuenta, se vincula el userId.
 */
export async function findOrCreateCustomer(params: {
  name: string;
  email: string;
  phone?: string | null;
  userId?: string | null;
}): Promise<{ id: string }> {
  const business = await requireCurrentBusiness();

  const normalizedEmail = params.email.trim().toLowerCase();

  // Buscar existente por email en este negocio
  const existing = await db.customer.findFirst({
    where: {
      businessId: business.id,
      email: normalizedEmail,
    },
    select: { id: true, userId: true },
  });

  if (existing) {
    // Si tiene userId y el existente no, vincular
    if (params.userId && !existing.userId) {
      await db.customer.update({
        where: { id: existing.id },
        data: { userId: params.userId },
      });
    }
    return existing;
  }

  // Crear nuevo
  const customer = await db.customer.create({
    data: {
      businessId: business.id,
      name: params.name.trim(),
      email: normalizedEmail,
      phone: params.phone?.trim() || null,
      userId: params.userId ?? null,
    },
    select: { id: true },
  });

  return customer;
}

/**
 * Crea un cliente nuevo directamente (para el dashboard del dueño).
 */
export async function createCustomer(params: {
  name: string;
  email: string;
  phone?: string | null;
}): Promise<{ id: string } | { error: string; fieldErrors?: Record<string, string> }> {
  await requireAuth();
  const business = await requireCurrentBusiness();

  const name = params.name.trim();
  const email = params.email.trim().toLowerCase();
  const phone = params.phone?.trim() || null;

  if (!name) {
    return { error: "El nombre es obligatorio.", fieldErrors: { name: "El nombre es obligatorio." } };
  }

  if (!email) {
    return { error: "El email es obligatorio.", fieldErrors: { email: "El email es obligatorio." } };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "El email no es válido.", fieldErrors: { email: "El email no es válido." } };
  }

  // Verificar duplicado
  const existing = await db.customer.findFirst({
    where: { businessId: business.id, email },
    select: { id: true },
  });

  if (existing) {
    return existing;
  }

  const customer = await db.customer.create({
    data: {
      businessId: business.id,
      name,
      email,
      phone,
    },
    select: { id: true },
  });

  return customer;
}
