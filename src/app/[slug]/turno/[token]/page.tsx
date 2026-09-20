import { notFound } from "next/navigation";
import Link from "next/link";
import { getAppointmentForPortal } from "@/lib/appointment-self-service";
import { AppointmentManage } from "@/components/booking/appointment-manage";

/**
 * Página pública de gestión del turno (autoservicio del cliente).
 *
 * La URL incluye un token firmado y un slug. El token se valida en servidor y
 * NO es necesario estar autenticado: el token es la credencial del turno.
 * El slug se verifica también en servidor para no servir gestiones fuera del
 * negocio correcto.
 */
export default async function AppointmentManagePage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;

  const result = await getAppointmentForPortal(token);

  if ("error" in result) notFound();

  const { appointment } = result;

  // El token pertenece a un turno; si el slug no coincide, no se sirve.
  if (appointment.business.slug !== slug) notFound();

  const businessName = appointment.business.name;
  const nowIso = new Date().toISOString();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-2xl">
          <Link
            href="/"
            className="mb-2 inline-block text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            ← Volver a la búsqueda
          </Link>
          <h1 className="text-xl font-semibold">{businessName}</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Gestioná tu turno
          </p>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6">
        <AppointmentManage
          appointment={{
            ...appointment,
            startsAt: appointment.startsAt.toISOString(),
            endsAt: appointment.endsAt.toISOString(),
          }}
          token={token}
          nowIso={nowIso}
        />
      </main>
    </div>
  );
}