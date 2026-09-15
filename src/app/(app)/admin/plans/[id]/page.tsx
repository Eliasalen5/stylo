import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { PlanForm } from "@/components/admin/plan-form";
import { TogglePlanButton } from "@/components/admin/toggle-plan-button";
import type { PlanState } from "@/app/actions/plans";

const initialState: PlanState = {};

export default async function EditPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePlatformAdmin();

  const { id } = await params;
  const plan = await db.plan.findUnique({ where: { id } });

  if (!plan) notFound();

  return (
    <div className="w-full max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Plan: {plan.name}</h1>
        <TogglePlanButton planId={plan.id} isActive={plan.isActive} />
      </div>
      <PlanForm
        state={initialState}
        submitLabel="Guardar cambios"
        plan={{
          id: plan.id,
          name: plan.name,
          description: plan.description,
          price: plan.price,
          interval: plan.interval,
          intervalCount: plan.intervalCount,
          limits:
            plan.limits !== null &&
            typeof plan.limits === "object" &&
            !Array.isArray(plan.limits)
              ? (plan.limits as Record<string, number>)
              : null,
        }}
      />
    </div>
  );
}