import { crmNoteSchema } from "@/lib/admin/financial-planning/contracts";
import { handlePlanningMutation, readJsonBody, requireHouseholdId, requireValid } from "@/lib/admin/financial-planning/http";
import { addCrmNote } from "@/lib/admin/financial-planning/store";

export const dynamic = "force-dynamic";

/** Owner-only: append an encrypted CRM note. Notes are never edited or deleted. */
export async function POST(request: Request, { params }: { params: Promise<{ householdId: string }> }) {
  return handlePlanningMutation(request, async () => {
    const householdId = requireHouseholdId((await params).householdId);
    const note = requireValid(crmNoteSchema.safeParse(await readJsonBody(request)));
    return addCrmNote(householdId, note);
  });
}
