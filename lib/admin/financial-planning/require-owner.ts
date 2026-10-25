import "server-only";

import { redirect } from "next/navigation";
import { getAdminIdentity } from "../identity";
import { canReadFinancialPlanning } from "./access";

/** Page guard: the financial planning room opens for the owner only (F1/F3). */
export async function requireFinancialPlanningOwner() {
  const identity = await getAdminIdentity();
  if (!identity) redirect("/login/");
  if (!canReadFinancialPlanning(identity)) redirect("/dashboard/?error=forbidden");
  return identity;
}
