import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await auth.protect();

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex h-14 items-center justify-between border-b border-zinc-200 px-4 sm:px-6 dark:border-zinc-800">
        <Link href="/dashboard" className="text-lg font-semibold">
          Stylo
        </Link>
        <UserButton
          appearance={{
            elements: { userButtonBox: { justifyContent: "center" } },
          }}
        />
      </header>
      {children}
    </div>
  );
}
