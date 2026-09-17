import { redirect } from "next/navigation";
import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/platform-admin";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requirePlatformAdmin();

  if (!user.isPlatformAdmin) redirect("/dashboard");

  return (
    <div className="flex flex-1 flex-col sm:flex-row">
      <aside className="w-full shrink-0 border-b border-zinc-200 bg-zinc-50 p-4 sm:w-56 sm:border-b-0 sm:border-r dark:border-zinc-800 dark:bg-zinc-950">
        <nav className="flex gap-1 sm:flex-col">
          <Link
            href="/admin/plans"
            className="rounded-md px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Planes
          </Link>
          <Link
            href="/admin/businesses"
            className="rounded-md px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Negocios
          </Link>
        </nav>
      </aside>
      <div className="flex flex-1 flex-col overflow-auto p-4 sm:p-6">{children}</div>
    </div>
  );
}