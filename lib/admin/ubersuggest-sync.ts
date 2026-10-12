import { NextResponse } from "next/server";
import { fetchUbersuggestDashboardSync } from "@/lib/admin/ubersuggest-dashboard-provider";
import { getUbersuggestDashboardData, isSnapshotFresh, persistUbersuggestDashboardSync } from "@/lib/admin/ubersuggest-dashboard";

export type UbersuggestSyncResult = { accountId: string; geoId: string; checkedAt: string; reused: boolean };
const SYNC_CACHE_HOURS = 1;

export async function runUbersuggestSync(actor: string, requestId: string): Promise<UbersuggestSyncResult> {
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


export function ubersuggestSyncFailure(error: unknown, requestId: string) {
    const code = error instanceof Error ? error.message : "";
    if (code === "UBERSUGGEST_LOCAL_ONLY") return NextResponse.json({ error: "provider-sync-local-required", requestId }, { status: 409 });
    if (code === "UBERSUGGEST_AUTH_REQUIRED") return NextResponse.json({ error: "provider-auth-required", requestId }, { status: 401 });
    if (code === "UBERSUGGEST_PROJECT_NOT_FOUND") return NextResponse.json({ error: "provider-project-not-found", requestId }, { status: 404 });
    if (code === "UBERSUGGEST_TIMEOUT") return NextResponse.json({ error: "provider-timeout", requestId }, { status: 504 });
    if (code === "UBERSUGGEST_INVALID_RESPONSE") return NextResponse.json({ error: "provider-invalid-response", requestId }, { status: 502 });
    if (["SANITY_WRITE_NOT_CONFIGURED", "ADMIN_DATABASE_NOT_CONFIGURED"].includes(code)) return NextResponse.json({ error: "research-write-not-configured", requestId }, { status: 503 });
    return NextResponse.json({ error: "provider-tool-failed", requestId }, { status: 502 });
}
