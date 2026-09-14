import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAvailableSlots } from "@/lib/availability";

export async function GET(request: NextRequest) {
  const professionalId = request.nextUrl.searchParams.get("professionalId");
  const serviceId = request.nextUrl.searchParams.get("serviceId");
  const date = request.nextUrl.searchParams.get("date");

  if (!professionalId || !serviceId || !date) {
    return NextResponse.json({ slots: [] });
  }

  // Obtener businessId desde el profesional
  const professional = await db.professional.findUnique({
    where: { id: professionalId },
    select: { businessId: true },
  });

  if (!professional) {
    return NextResponse.json({ slots: [] });
  }

  try {
    const slots = await getAvailableSlots(
      professional.businessId,
      professionalId,
      serviceId,
      date
    );

    // Convertir Date a string ISO para el client
    const serialized = slots.map((s) => ({
      startTime: s.startTime,
      endTime: s.endTime,
      startsAtUTC: s.startsAtUTC.toISOString(),
    }));

    return NextResponse.json({ slots: serialized });
  } catch (error) {
    console.error("Error fetching slots", error);
    return NextResponse.json({ slots: [] });
  }
}
