"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Perfil" },
  { href: "/dashboard/appointments", label: "Turnos" },
  { href: "/dashboard/services", label: "Servicios" },
  { href: "/dashboard/professionals", label: "Profesionales" },
  { href: "/dashboard/hours", label: "Horarios" },
  { href: "/dashboard/customers", label: "Clientes" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-full shrink-0 border-b border-zinc-200 bg-zinc-50 p-4 sm:w-56 sm:border-b-0 sm:border-r dark:border-zinc-800 dark:bg-zinc-950">
      <nav className="flex gap-1 sm:flex-col">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-600 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
