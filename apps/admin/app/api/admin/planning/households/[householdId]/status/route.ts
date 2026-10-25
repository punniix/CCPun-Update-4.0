import { clientStatusRequestSchema } from "@/lib/admin/financial-planning/contracts";
import { handlePlanningMutation, readJsonBody, requireHouseholdId, requireValid } from "@/lib/admin/financial-planning/http";
import { setClientStatus } from "@/lib/admin/financial-planning/store";

export const dynamic = "force-dynamic";

/** Owner-only: mark a household active or former. Sets retention; never deletes. */
export async function POST(request: Request, { params }: { params: Promise<{ householdId: string }> }) {
  return handlePlanningMutation(request, async () => {
    const householdId = requireHouseholdId((await params).householdId);
    const status = requireValid(clientStatusRequestSchema.safeParse(await readJsonBody(request)));
    return setClientStatus(householdId, status);
  });
}
