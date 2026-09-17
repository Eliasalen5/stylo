import { requireCurrentMembership } from "@/lib/current-business";
import { BusinessProfileForm } from "@/components/business/business-profile-form";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const membership = await requireCurrentMembership(params);
  const business = membership.business;
  const canEdit = membership.role === "OWNER";

  return (
    <div className="w-full max-w-2xl">
      <h1 className="text-2xl font-semibold">Perfil del negocio</h1>

      {canEdit ? (
        <BusinessProfileForm business={business} />
      ) : (
        <div className="mt-6 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
          <h2 className="text-xl font-semibold">{business.name}</h2>
          <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-zinc-500 dark:text-zinc-400">Slug</dt>
              <dd className="font-mono text-sm">{business.slug}</dd>
            </div>
            <div>
              <dt className="text-sm text-zinc-500 dark:text-zinc-400">Zona horaria</dt>
              <dd className="text-sm">{business.timezone}</dd>
            </div>
            {business.phone && (
              <div>
                <dt className="text-sm text-zinc-500 dark:text-zinc-400">Teléfono</dt>
                <dd className="text-sm">{business.phone}</dd>
              </div>
            )}
            {business.email && (
              <div>
                <dt className="text-sm text-zinc-500 dark:text-zinc-400">Email</dt>
                <dd className="text-sm">{business.email}</dd>
              </div>
            )}
            {business.address && (
              <div>
                <dt className="text-sm text-zinc-500 dark:text-zinc-400">Dirección</dt>
                <dd className="text-sm">{business.address}</dd>
              </div>
            )}
          </dl>
          {business.description && (
            <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
              {business.description}
            </p>
          )}
        </div>
      )}
    </div>
  );
}