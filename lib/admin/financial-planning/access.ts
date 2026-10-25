import { isSameOriginAdminMutation } from "../auth-config";
import { hasAdminPermission, type AdminRole } from "../rbac";

/**
 * Owner-only access to the financial planning room (decision F1/F3).
 *
 * Two independent checks must both pass: the role must be exactly "owner" and
 * that role must hold the planning permission. Granting a planning permission
 * to another role in rbac.ts is therefore still not enough to open this data.
 */
export type FaAccessIdentity = { actorType: "human"; role: AdminRole } | null | undefined;

export function canReadFinancialPlanning(identity: FaAccessIdentity): boolean {
  return Boolean(identity && identity.actorType === "human" && identity.role === "owner"
    && hasAdminPermission(identity.role, "planning:read"));
}

export function canWriteFinancialPlanning(identity: FaAccessIdentity): boolean {
  return canReadFinancialPlanning(identity) && hasAdminPermission(identity!.role, "planning:write");
}

export type FaRequestDecision =
  | { ok: true }
  | { ok: false; status: 401 | 403; error: "unauthorized" | "forbidden" | "invalid-origin" };

export function authorizeFinancialPlanningRequest(input: {
  identity: FaAccessIdentity;
  mutation: boolean;
  requestUrl: string;
  origin: string | null;
}): FaRequestDecision {
  if (!input.identity) return { ok: false, status: 401, error: "unauthorized" };
  const allowed = input.mutation ? canWriteFinancialPlanning(input.identity) : canReadFinancialPlanning(input.identity);
  if (!allowed) return { ok: false, status: 403, error: "forbidden" };
  if (input.mutation && !isSameOriginAdminMutation(input.requestUrl, input.origin)) {
    return { ok: false, status: 403, error: "invalid-origin" };
  }
  return { ok: true };
}

/** Responses carrying planning data must never be cached or indexed. */
export const FA_PRIVATE_HEADERS = {
  "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
} as const;
