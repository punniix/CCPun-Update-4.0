import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getAdminEnvironment } from "@/lib/admin/environment";
import { getAdminIdentity } from "@/lib/admin/identity";
import { evaluateAdminAction } from "@/lib/admin/policy";
import { hasAdminPermission } from "@/lib/admin/rbac";
import { runUbersuggestSync, ubersuggestSyncFailure, type UbersuggestSyncResult } from "@/lib/admin/ubersuggest-sync";


let syncInFlight: Promise<UbersuggestSyncResult> | null = null;

export async function POST() {
  const identity = await getAdminIdentity();
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const policy = evaluateAdminAction({
    actorType: identity.actorType,
    role: identity.role,
    action: "research:create",
    environment: getAdminEnvironment(),
  });
  if (!policy.allowed || identity.actorType !== "human" || !hasAdminPermission(identity.role, "research:provider-query")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const requestId = randomUUID();
  const task = syncInFlight ?? runUbersuggestSync(identity.actor, requestId);
  syncInFlight = task;
  try {
    const result = await task;
    return NextResponse.json({ ...result, requestId }, { status: result.reused ? 200 : 201 });
  } catch (error) {
    return ubersuggestSyncFailure(error, requestId);
  } finally {
    if (syncInFlight === task) syncInFlight = null;
  }
}
