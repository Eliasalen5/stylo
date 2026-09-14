import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Busca o crea un cliente para un negocio. Endpoint público (booking público).
 *
 * Seguridad:
 *  - El businessId NUNCA se recibe del cliente. Se deriva del slug del negocio,
 *    que es un identificador público (aparece en la URL /[slug]).
 *  - El email se normaliza y se reutiliza el cliente si ya existe en el negocio.
 *
 * Rate limiting: pendiente (los endpoints públicos deberán protegerse).
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const { name, email, phone } = (body ?? {}) as {
    name?: unknown;
    email?: unknown;
    phone?: unknown;
  };
  const businessSlug =
    typeof (body as { businessSlug?: unknown })?.businessSlug === "string"
      ? (body as { businessSlug: string }).businessSlug.trim()
      : "";

  if (!businessSlug) {
    return NextResponse.json(
      { error: "Falta el slug del negocio." },
      { status: 400 }
    );
  }

  const business = await db.business.findFirst({
    where: { slug: businessSlug, isActive: true },
    select: { id: true },
  });

  if (!business) {
    return NextResponse.json(
      { error: "El negocio no existe o no está disponible." },
      { status: 404 }
    );
  }

  const customerName = typeof name === "string" ? name.trim() : "";
  const customerEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  const customerPhone = typeof phone === "string" ? phone.trim() || null : null;

  if (!customerName) {
    return NextResponse.json(
      { error: "El nombre es obligatorio." },
      { status: 400 }
    );
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    return NextResponse.json({ error: "El email no es válido." }, { status: 400 });
  }

  // Buscar existente por email en este negocio.
  const existing = await db.customer.findFirst({
    where: { businessId: business.id, email: customerEmail },
    select: { id: true },
  });

  if (existing) {
    return NextResponse.json({ id: existing.id, created: false });
  }

  try {
    const customer = await db.customer.create({
      data: {
        businessId: business.id,
        name: customerName,
        email: customerEmail,
        phone: customerPhone,
      },
      select: { id: true },
    });

    return NextResponse.json({ id: customer.id, created: true }, { status: 201 });
  } catch (error) {
    // Carrera de find-or-create: el constraint único [businessId, email] hizo
    // fallar el create; reintentar la búsqueda.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "P2002"
    ) {
      const duplicate = await db.customer.findFirst({
        where: { businessId: business.id, email: customerEmail },
        select: { id: true },
      });

      if (duplicate) {
        return NextResponse.json({ id: duplicate.id, created: false });
      }
    }

    console.error("Error al crear cliente", error);
    return NextResponse.json(
      { error: "No se pudo registrar al cliente. Intentalo de nuevo." },
      { status: 500 }
    );
  }
}