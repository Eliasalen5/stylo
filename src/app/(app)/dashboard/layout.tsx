import { getCurrentUser } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <div className="flex flex-1 flex-col sm:flex-row">
      <Sidebar isPlatformAdmin={user?.isPlatformAdmin ?? false} />
      <div className="flex flex-1 flex-col overflow-auto p-4 sm:p-6">
        {children}
      </div>
    </div>
  );
}