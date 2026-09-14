import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PublicBooking } from "@/components/booking/public-booking";

export default async function PublicBookingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const business = await db.business.findUnique({
    where: { slug, isActive: true },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      phone: true,
      timezone: true,
    },
  });

  if (!business) notFound();

  const [services, professionals] = await Promise.all([
    db.service.findMany({
      where: { businessId: business.id, isActive: true },
      orderBy: { createdAt: "asc" },
    }),
    db.professional.findMany({
      where: { businessId: business.id, isActive: true },
      include: {
        services: {
          select: { id: true, name: true, durationMinutes: true, price: true },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-xl font-semibold">{business.name}</h1>
          {business.description && (
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {business.description}
            </p>
          )}
          {business.phone && (
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {business.phone}
            </p>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6">
        <PublicBooking
          businessSlug={business.slug}
          services={services}
          professionals={professionals}
        />
      </main>
    </div>
  );
}
