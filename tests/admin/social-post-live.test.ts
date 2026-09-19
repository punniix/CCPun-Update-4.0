import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CCPUN_VERCEL_PROJECT_IDS } from "../../lib/admin/environment";
import { SYNTHETIC_SOCIAL_FOUNDATION } from "../../lib/admin/social/foundation";
import { SYNTHETIC_PUBLISHED_SOCIAL_RECORDS } from "../../lib/admin/social/operations";
import {
  isSyntheticPostLiveRuntimeEnabled,
  normalizePostLiveSnapshot,
  postLiveSnapshotSchema,
  SYNTHETIC_POST_LIVE_REPORT,
} from "../../lib/admin/social/post-live";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("Post-Live fixture links a completed Live to publication and Master Content", () => {
  const snapshot = SYNTHETIC_POST_LIVE_REPORT.snapshots[0]!;
  const variant = SYNTHETIC_SOCIAL_FOUNDATION.variants.find((item) => item.id === snapshot.variantId);
  const publication = SYNTHETIC_PUBLISHED_SOCIAL_RECORDS.find((item) => item.publicationId === snapshot.publicationId);
  assert.equal(variant?.format, "live");
  assert.equal(variant?.masterContentId, snapshot.masterContentId);
  assert.equal(publication?.variantId, snapshot.variantId);
  assert.equal(snapshot.collectionMode, "manual-post-live");
  assert.equal(snapshot.realtimePollingAllowed, false);
  assert.equal(snapshot.providerRequestAllowed, false);
  assert.notDeepEqual(snapshot.nativeMetrics, snapshot.normalizedMetrics);
});

test("Provider-neutral contract exposes unavailable and unsupported states without fake metrics", () => {
  const base = SYNTHETIC_POST_LIVE_REPORT.snapshots[0]!;
  for (const providerState of ["unavailable", "unsupported"] as const) {
    const result = postLiveSnapshotSchema.parse({ ...base, snapshotId: `post-live-${providerState}`, providerState, nativeMetrics: [], normalizedMetrics: [] });
    assert.equal(result.providerState, providerState);
    assert.equal(result.nativeMetrics.length, 0);
  }
  assert.equal(postLiveSnapshotSchema.safeParse({ ...base, providerState: "available", nativeMetrics: [], normalizedMetrics: [] }).success, false);
  assert.equal(postLiveSnapshotSchema.safeParse({ ...base, providerState: "unavailable", normalizedMetrics: [] }).success, false);
  assert.equal(postLiveSnapshotSchema.safeParse({ ...base, fetchedAt: "2026-08-28T08:00:00.000Z" }).success, false);
});

test("synthetic Post-Live runtime is UAT-only and fails closed in Production", () => {
  const uatEnv = {
    CCPUN_SOCIAL_OPERATIONS_ENABLED: "1",
    CCPUN_APP_ENV: "admin-uat",
    VERCEL_PROJECT_ID: CCPUN_VERCEL_PROJECT_IDS.adminProduction,
    VERCEL_GIT_COMMIT_REF: "codex/website-42-social-analytics-ingestion-20260831",
    NEXT_PUBLIC_SANITY_PROJECT_ID: "ccb9lnw5",
    NEXT_PUBLIC_SANITY_DATASET: "uat",
  };
  assert.equal(isSyntheticPostLiveRuntimeEnabled(uatEnv), true);
  assert.equal(isSyntheticPostLiveRuntimeEnabled({ ...uatEnv, CCPUN_SOCIAL_OPERATIONS_ENABLED: "0" }), false);

  const productionEnv = {
    CCPUN_SOCIAL_OPERATIONS_ENABLED: "1",
    CCPUN_APP_ENV: "production-admin",
    VERCEL_ENV: "production",
    VERCEL_PROJECT_ID: CCPUN_VERCEL_PROJECT_IDS.adminProduction,
    CCPUN_PRODUCTION_ADMIN_VERCEL_PROJECT_ID: CCPUN_VERCEL_PROJECT_IDS.adminProduction,
    VERCEL_GIT_COMMIT_REF: "v4-production",
    NEXT_PUBLIC_SANITY_PROJECT_ID: "kyfxgjnq",
    NEXT_PUBLIC_SANITY_DATASET: "production",
    CCPUN_NEON_PROJECT_ID: "production-project-id",
    CCPUN_NEON_BRANCH_ID: "br-production-id",
    CCPUN_NEON_ENDPOINT_ID: "ep-production-id",
    CCPUN_NEON_DATABASE: "production_social",
    CCPUN_SOCIAL_DATABASE_URL: "postgresql://ccpun_social_runtime:secret@ep-production-id-pooler.ap-southeast-1.aws.neon.tech/production_social",
  };
  assert.equal(isSyntheticPostLiveRuntimeEnabled(productionEnv), false);
});

test("Post-Live preview route is authenticated, exact-origin and GET-only", () => {
  const route = read("app/api/admin/social/analytics/post-live/route.ts");
  const page = read("features/admin/social/post-live-page.tsx");
  const entry = read("app/(control-plane)/analytics/social/post-live/page.tsx");
  const analytics = read("features/admin/social/analytics-page.tsx");
  const layout = read("apps/admin/app/(control-plane)/layout.tsx");
  const queue = read("features/admin/social/operations-page.tsx");
  assert.match(route, /getAdminIdentity\(\)/);
  assert.match(route, /hasAdminPermission\(identity\.role, "social:read"\)/);
  assert.match(route, /isConfiguredAdminOrigin\(request\.url, process\.env\.AUTH_URL\)/);
  assert.match(route, /isSyntheticPostLiveRuntimeEnabled\(process\.env\)/);
  assert.match(route, /export async function GET\(request: Request\)/);
  assert.doesNotMatch(route, /export async function (?:POST|PUT|PATCH|DELETE)/);
  assert.doesNotMatch(route, /fetch\(|setInterval|cron|createClient/);
  assert.match(page, /requireAdminPermission\("social:read"\)/);
  assert.match(page, /runtime\.environment === "production-admin"/);
  assert.match(page, /ไม่ติดตามแบบทันที ไม่ดึงข้อมูลเบื้องหลัง/);
  assert.equal(entry.trim(), 'export { metadata, default } from "@/features/admin/social/post-live-page";');
  assert.match(analytics, /โซเชียล · ผลลัพธ์/);
  assert.match(layout, /href: "\/analytics\/social\/", label: "ผลลัพธ์โซเชียล"/);
  assert.doesNotMatch(queue, /\/analytics\/social\/post-live\//);
});

test("Post-Live ingestion normalizes historical provider evidence without enabling provider calls", () => {
  const source = SYNTHETIC_POST_LIVE_REPORT.snapshots[0]!;
  const normalized = normalizePostLiveSnapshot({
    snapshotId: "post-live-provider-adapter-001",
    publicationId: source.publicationId,
    masterContentId: source.masterContentId,
    variantId: source.variantId,
    platform: source.platform,
    providerState: source.providerState,
    liveEndedAt: source.liveEndedAt,
    fetchedAt: source.fetchedAt,
    nativeMetrics: source.nativeMetrics,
    normalizedMetrics: source.normalizedMetrics,
    limitations: source.limitations,
  });
  assert.equal(normalized.collectionMode, "manual-post-live");
  assert.equal(normalized.realtimePollingAllowed, false);
  assert.equal(normalized.providerRequestAllowed, false);
});
