import { savePlanRequestSchema } from "@/lib/admin/financial-planning/contracts";
import { handlePlanningMutation, readJsonBody, requireHouseholdId, requireValid } from "@/lib/admin/financial-planning/http";
import { saveHouseholdPlan } from "@/lib/admin/financial-planning/store";

export const dynamic = "force-dynamic";

/** Owner-only: replace the household profile and financial position atomically. */
export async function PUT(request: Request, { params }: { params: Promise<{ householdId: string }> }) {
  return handlePlanningMutation(request, async () => {
    const householdId = requireHouseholdId((await params).householdId);
    const body = requireValid(savePlanRequestSchema.safeParse(await readJsonBody(request)));
    return saveHouseholdPlan({ householdId, ...body });
  });
}
