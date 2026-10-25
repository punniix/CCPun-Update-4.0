import { z } from "zod";
import { householdProfileSchema } from "@/lib/admin/financial-planning/contracts";
import { handlePlanningMutation, readJsonBody, requireValid } from "@/lib/admin/financial-planning/http";
import { createHousehold } from "@/lib/admin/financial-planning/store";

export const dynamic = "force-dynamic";

const createSchema = z.object({ profile: householdProfileSchema }).strict();

/** Owner-only: create a household with an encrypted profile. */
export async function POST(request: Request) {
  return handlePlanningMutation(request, async () => {
    const body = requireValid(createSchema.safeParse(await readJsonBody(request)));
    return createHousehold(body.profile);
  });
}
