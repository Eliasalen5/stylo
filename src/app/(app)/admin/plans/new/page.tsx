import { requirePlatformAdmin } from "@/lib/platform-admin";
import { PlanForm } from "@/components/admin/plan-form";
import type { PlanState } from "@/app/actions/plans";

const initialState: PlanState = {};

export default async function NewPlanPage() {
  await requirePlatformAdmin();

  return (
    <div className="w-full max-w-2xl">
      <h1 className="text-2xl font-semibold">Nuevo plan</h1>
      <PlanForm state={initialState} submitLabel="Crear plan" />
    </div>
  );
}