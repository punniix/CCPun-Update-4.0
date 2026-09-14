import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("Meta capability probe is server-only, bounded, read-only, and keeps tokens out of URLs", () => {
  const source = read("lib/admin/social/providers/meta/capability-probe.ts");
  assert.match(source, /import "server-only"/);
  assert.match(source, /Authorization: `Bearer \$\{token\}`/);
  assert.match(source, /method: "GET"/);
  assert.match(source, /AbortSignal\.timeout\(15_000\)/);
  assert.match(source, /limit: 20/);
  assert.match(source, /limit: 25/);
  assert.doesNotMatch(source, /access_token=|searchParams\.set\([^\n]*token/i);
  assert.doesNotMatch(source, /method: "POST"|method: "PUT"|method: "PATCH"|method: "DELETE"/);
  assert.doesNotMatch(source, /console\.log|console\.error/);
});

test("Meta capability probe tests current insights families without inventing metric values", () => {
  const source = read("lib/admin/social/providers/meta/capability-probe.ts");
  for (const metric of [
    "page_media_view",
    "post_media_view",
    "post_clicks",
    "post_reactions_by_type_total",
    "views",
    "reach",
    "saved",
    "shares",
    "total_interactions",
    "ig_reels_video_view_total_time",
    "ig_reels_avg_watch_time",
  ]) assert.match(source, new RegExp(metric));
  assert.match(source, /"available"/);
  assert.match(source, /"empty"/);
  assert.match(source, /"permission_denied"/);
  assert.match(source, /"unsupported_or_invalid"/);
  assert.match(source, /"rate_limited"/);
  assert.doesNotMatch(source, /values?\s*:/i);
});

test("Meta capability probe distinguishes configured attestation from live token permission evidence", () => {
  const source = read("lib/admin/social/providers/meta/capability-probe.ts");
  assert.match(source, /CCPUN_META_GRANTED_SCOPES/);
  assert.match(source, /read_insights/);
  assert.match(source, /instagram_manage_insights/);
  assert.match(source, /"me\/permissions"/);
  assert.match(source, /configuredScopeAttestation/);
  assert.match(source, /livePermissions/);
  assert.match(source, /providerWriteAllowed: false/);
  assert.match(source, /persisted: false/);
});

test("Meta capability HTTP route is human-only, same-origin, POST-only, and never writes provider data", () => {
  const route = read("app/api/admin/social/providers/meta/capabilities/route.ts");
  assert.match(route, /getAdminIdentity\(\)/);
  assert.match(route, /identity\.actorType !== "human"/);
  assert.match(route, /hasAdminPermission\(identity\.role, "social:read"\)/);
  assert.match(route, /isConfiguredAdminOrigin/);
  assert.match(route, /isSameOriginAdminMutation/);
  assert.match(route, /export async function POST\(request: Request\)/);
  assert.doesNotMatch(route, /export async function (GET|PUT|PATCH|DELETE)/);
  assert.match(route, /probeMetaInsightsCapabilities\(\)/);
  assert.doesNotMatch(route, /social_provider|INSERT INTO|UPDATE |DELETE FROM|publish|execute/);
});
