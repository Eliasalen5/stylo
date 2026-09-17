import { requireCurrentBusiness } from "@/lib/current-business";
import { getBusinessStats } from "@/lib/stats";
import { StatsOverview } from "@/components/stats/stats-overview";

export default async function StatsPage() {
  const business = await requireCurrentBusiness();
  const stats = await getBusinessStats(business.id, 30, business.timezone);

  return <StatsOverview stats={stats} />;
}