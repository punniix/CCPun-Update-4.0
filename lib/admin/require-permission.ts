import "server-only";

import { redirect } from "next/navigation";
import { getAdminIdentity } from "./identity";
import { hasAdminPermission, type AdminPermission } from "./rbac";

export async function requireAdminPermission(permission: AdminPermission) {
  const identity = await getAdminIdentity();
  if (!identity) redirect("/login/");
  if (!hasAdminPermission(identity.role, permission)) redirect("/dashboard/?error=forbidden");
  return identity;
}
