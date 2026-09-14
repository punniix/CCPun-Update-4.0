import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getAdminEnvironment } from "@/lib/admin/environment";
import { getAdminIdentity } from "@/lib/admin/identity";
import { evaluateAdminAction } from "@/lib/admin/policy";
import { hasAdminPermission } from "@/lib/admin/rbac";
import { fetchUbersuggestDashboardSync } from "@/lib/admin/ubersuggest-dashboard-provider";
import { getUbersuggestDashboardData, isSnapshotFresh, persistUbersuggestDashboardSync } from "@/lib/admin/ubersuggest-dashboard";

type SyncResult = { accountId: string; geoId: string; checkedAt: string; reused: boolean };
let syncInFlight: Promise<SyncResult> | null = null;
const SYNC_CACHE_HOURS = 1;

async function runSync(actor: string, requestId: string): Promise<SyncResult> {
  const current = await getUbersuggestDashboardData(1);
  if (
    current.account &&
    current.geo &&
    isSnapshotFresh(current.account.checkedAt, SYNC_CACHE_HOURS) &&
    isSnapshotFresh(current.geo.checkedAt, SYNC_CACHE_HOURS)
  ) {
    return { accountId: current.account.id, geoId: current.geo.id, checkedAt: current.account.checkedAt, reused: true };
  }

  const providerData = await fetchUbersuggestDashboardSync("ccpun.com");
  const saved = await persistUbersuggestDashboardSync(providerData, { actor, actorType: "human", requestId });
  return { ...saved, reused: false };
}

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
  const task = syncInFlight ?? runSync(identity.actor, requestId);
  syncInFlight = task;
  try {
    const result = await task;
    return NextResponse.json({ ...result, requestId }, { status: result.reused ? 200 : 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "UBERSUGGEST_LOCAL_ONLY") return NextResponse.json({ error: "provider-sync-local-required", requestId }, { status: 409 });
    if (code === "UBERSUGGEST_AUTH_REQUIRED") return NextResponse.json({ error: "provider-auth-required", requestId }, { status: 401 });
    if (code === "UBERSUGGEST_PROJECT_NOT_FOUND") return NextResponse.json({ error: "provider-project-not-found", requestId }, { status: 404 });
    if (code === "UBERSUGGEST_TIMEOUT") return NextResponse.json({ error: "provider-timeout", requestId }, { status: 504 });
    if (code === "UBERSUGGEST_INVALID_RESPONSE") return NextResponse.json({ error: "provider-invalid-response", requestId }, { status: 502 });
    if (["SANITY_WRITE_NOT_CONFIGURED", "ADMIN_DATABASE_NOT_CONFIGURED"].includes(code)) return NextResponse.json({ error: "research-write-not-configured", requestId }, { status: 503 });
    return NextResponse.json({ error: "provider-tool-failed", requestId }, { status: 502 });
  } finally {
    if (syncInFlight === task) syncInFlight = null;
  }
}
