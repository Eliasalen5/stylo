import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { listDirectoryBusinesses } from "@/lib/directory";
import { BusinessCard } from "@/components/directory/business-card";

export const dynamic = "force-dynamic";

type HomeSearchParams = Promise<{ q?: string | string[] }>;

export default async function Home({ searchParams }: { searchParams: HomeSearchParams }) {
  const { userId } = await auth();
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim().slice(0, 100) : "";

  const businesses = await listDirectoryBusinesses(query);

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Stylo
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            {userId ? (
              <Link
                href="/dashboard"
                className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                Mi negocio
              </Link>
            ) : (
              <>
                <Link
                  href="/sign-in"
                  className="rounded-md border border-zinc-300 px-4 py-2 font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                >
                  Entrar
                </Link>
                <Link
                  href="/sign-up"
                  className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                >
                  Creá tu barbería
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-10">
        <section className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Reservá tu turno
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-zinc-600 dark:text-zinc-400">
            Buscá la barbería o peluquería que quieras, elegí servicio y
            profesional, y reservá en segundos.
          </p>
        </section>

        <form action="/" method="get" className="mx-auto mt-8 flex max-w-xl gap-2">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Buscar por nombre o descripción..."
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="submit"
            className="shrink-0 rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Buscar
          </button>
        </form>

        <section className="mt-10">
          <h2 className="text-lg font-semibold">
            {query ? `Resultados para "${query}"` : "Negocios disponibles"}
          </h2>

          {businesses.length > 0 ? (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {businesses.map((business) => (
                <BusinessCard
                  key={business.slug}
                  name={business.name}
                  slug={business.slug}
                  description={business.description}
                  address={business.address}
                  phone={business.phone}
                  logoUrl={business.logoUrl}
                  isFeatured={business.isFeatured}
                  servicesCount={business.servicesCount}
                  professionalsCount={business.professionalsCount}
                />
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-dashed border-zinc-300 px-6 py-12 text-center dark:border-zinc-700">
              <p className="text-zinc-600 dark:text-zinc-400">
                {query
                  ? "No encontramos negocios que coincidan con tu búsqueda."
                  : "Todavía no hay negocios publicados."}
              </p>
            </div>
          )}
        </section>

        <footer className="mt-14 border-t border-zinc-200 pt-6 text-center dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            ¿Tenés una barbería o peluquería?{" "}
            <Link
              href={userId ? "/dashboard" : "/sign-up"}
              className="font-medium text-zinc-900 underline underline-offset-2 hover:text-zinc-600 dark:text-zinc-100 dark:hover:text-zinc-400"
            >
              Creá tu página y administrá tus turnos
            </Link>
          </p>
        </footer>
      </main>
    </div>
  );
}