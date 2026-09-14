import { Sidebar } from "@/components/layout/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col sm:flex-row">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-auto p-4 sm:p-6">
        {children}
      </div>
    </div>
  );
}
