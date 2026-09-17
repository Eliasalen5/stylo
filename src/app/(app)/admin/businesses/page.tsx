import Link from "next/link";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { ToggleFeaturedButton } from "@/components/admin/toggle-featured-button";

export default async function AdminBusinessesPage() {
  await requirePlatformAdmin();

  const businesses = await db.business.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      isFeatured: true,
      isActive: true,
    },
    orderBy: [{ isFeatured: "desc" }, { name: "asc" }],
  });

  return (
    <div className="w-full max-w-3xl">
      <h1 className="text-2xl font-semibold">Negocios</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Destacá negocios para que aparezcan primero en el directorio público.
      </p>

      {businesses.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          No hay negocios registrados todavía.
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {businesses.map((business) => (
            <div
              key={business.id}
              className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="font-medium">{business.name}</h2>
                  {business.isFeatured && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                      Destacado
                    </span>
                  )}
                  {!business.isActive && (
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                      Inactivo
                    </span>
                  )}
                </div>
                <Link
                  href={`/${business.slug}`}
                  className="mt-0.5 block truncate text-sm text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
                >
                  /{business.slug}
                </Link>
              </div>
              <div className="ml-4 shrink-0">
                <ToggleFeaturedButton
                  businessId={business.id}
                  isFeatured={business.isFeatured}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}