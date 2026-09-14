import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { createBooking } from "@/lib/booking";
import { parseStartsAt } from "@/lib/datetime";

/**
 * Reserva un turno desde el booking público /[slug].
 *
 * Seguridad:
 *  - El businessId NUNCA se recibe del cliente: se deriva en servidor desde el
 *    professionalId (que ya pertenece a un único negocio).
 *  - El serviceId y customerId se validan contra el negocio del profesional.
 *  - La disponibilidad, la grilla y el precio se validan server-side.
 *  - Sin doble reserva: transacción atómica + constraint único.
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

  const { serviceId, professionalId, customerId, startsAt } = (body ?? {}) as {
    serviceId?: unknown;
    professionalId?: unknown;
    customerId?: unknown;
    startsAt?: unknown;
  };

  if (
    typeof serviceId !== "string" ||
    typeof professionalId !== "string" ||
    typeof customerId !== "string" ||
    typeof startsAt !== "string"
  ) {
    return NextResponse.json(
      { error: "Parámetros inválidos." },
      { status: 400 }
    );
  }

  // Derivar el negocio desde el profesional (nunca del cliente).
  const professional = await db.professional.findFirst({
    where: {
      id: professionalId,
      isActive: true,
      business: { isActive: true },
    },
    include: { business: { select: { id: true, timezone: true } } },
  });

  if (!professional) {
    return NextResponse.json(
      { error: "Profesional no encontrado o inactivo." },
      { status: 404 }
    );
  }

  const parsedStartsAt = parseStartsAt(startsAt);
  if (!parsedStartsAt) {
    return NextResponse.json({ error: "Fecha y hora inválidas." }, { status: 400 });
  }

  const result = await createBooking({
    businessId: professional.businessId,
    businessTimezone: professional.business.timezone,
    professionalId,
    serviceId,
    customerId,
    startsAt: parsedStartsAt,
  });

  if ("error" in result) {
    const status =
      result.kind === "unavailable"
        ? 409
        : result.kind === "invalid"
          ? 400
          : result.kind === "internal"
            ? 500
            : 404;
    return NextResponse.json({ error: result.error }, { status });
  }

  revalidatePath("/[slug]", "page");

  return NextResponse.json({ id: result.id }, { status: 201 });
}