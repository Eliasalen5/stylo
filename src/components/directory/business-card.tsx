import Link from "next/link";

type BusinessCardProps = {
  name: string;
  slug: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  logoUrl: string | null;
  servicesCount: number;
  professionalsCount: number;
};

export function BusinessCard({
  name,
  slug,
  description,
  address,
  phone,
  logoUrl,
  servicesCount,
  professionalsCount,
}: BusinessCardProps) {
  return (
    <Link
      href={`/${slug}`}
      className="group flex h-full flex-col rounded-lg border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-400 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
    >
      <div className="flex items-start gap-4">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={name}
            className="h-12 w-12 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-lg font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
            {name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <h2 className="font-semibold text-zinc-900 group-hover:underline dark:text-zinc-100">
            {name}
          </h2>
          {description && (
            <p className="mt-1 line-clamp-2 text-sm text-zinc-500 dark:text-zinc-400">
              {description}
            </p>
          )}
        </div>
      </div>

      {(address || phone) && (
        <dl className="mt-4 space-y-1 text-sm text-zinc-500 dark:text-zinc-400">
          {address && (
            <dt className="sr-only">Dirección</dt>
          )}
          {address && <dd>{address}</dd>}
          {phone && <dd>{phone}</dd>}
        </dl>
      )}

      <p className="mt-4 border-t border-zinc-100 pt-3 text-xs text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {servicesCount} servicios · {professionalsCount} profesionales
      </p>
    </Link>
  );
}