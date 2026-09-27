import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildSocialExportSheets, createSocialGoogleSpreadsheet } from "../../lib/admin/social/sheets-export";

const now = new Date("2026-09-01T05:00:00.000Z");
const authorization = {
  scope: "https://www.googleapis.com/auth/drive.file",
  mode: "owner-interactive",
  tokenPersistence: "memory-only",
  refreshTokenPersistence: "forbidden",
  issuedAtMs: now.getTime() - 1_000,
  expiresAtMs: now.getTime() + 3_000_000,
} as const;

test("Sheets export preserves raw tabs and adds clean marketing, coverage and QA tabs", () => {
  const sheets = buildSocialExportSheets({
    contents: [{ record_type: "current", content_id: "content:1", provider: "meta", platform: "facebook", provider_account_id: "page:1",
      provider_object_id: "post:1", linked_publication_id: "publication:1", published_at: now, captured_at: now,
      text_content: "=not-a-formula", media_type: "text", permalink_url: null, thumbnail_url: null, first_seen_at: now, last_seen_at: now }],
    publications: [{ publication_id: "publication:1", variant_id: "variant:1", master_content_id: "master:1", channel: "facebook",
      format: "text-post", publishing_mode: "native-scheduled", editorial_revision: "revision:1", editorial_version: 1,
      status: "published", execution_target: "facebook-native-scheduled", scheduled_at: now, platform_object_id: "post:1",
      published_at: now, created_at: now, updated_at: now, job_id: "job:1", job_type: "publish", job_status: "succeeded",
      job_version: 1, attempt_count: 1 }],
    metrics: [{ source: "provider-content", source_id: "snapshot:1", content_id: "content:1", publication_id: null,
      provider: "meta", platform: "facebook", platform_object_id: "post:1", fetched_at: now, limitations: [],
      native_metrics: [
        { key: "facebook.reactions", label: "Reactions", value: 12, unit: "count", dimension: "engagement" },
        { key: "facebook.comments", label: "Comments", value: 4, unit: "count", dimension: "engagement" },
      ] }],
    cleanPosts: [{
      content_id: "content:1", publication_id: "publication:1", provider: "meta", platform: "facebook",
      provider_object_id: "post:1", permalink: "https://www.facebook.com/post:1", thumbnail: null,
      text_content: "=not-a-formula", provider_media_type: "text", format_standard: "text", published_at_utc: now,
      published_at_bkk_text: "2026-09-01 12:00:00", publish_date_bkk: "2026-09-01", publish_day_of_week: 2,
      publish_hour_bkk: 12, snapshot_at: now, metric_window: "latest", reactions_total: 12, likes: null,
      comments_total: 4, shares: 2, saves: null, reach: null, impressions: null, views: 100, clicks: 10,
      total_interactions: null, reel_total_watch_time_ms: null, reel_average_watch_time_ms: null,
      known_engagement_rate_by_reach: null, known_deep_engagement_rate_by_reach: null,
      audience_engagement_rate_by_reach: null, audience_deep_engagement_rate_by_reach: null,
      known_engagement_total: 18, known_deep_engagement_total: 6, engagement_components_complete: true,
      comment_attribution_status: "not_collected", clicks_per_view: 0.1,
      expected_core_metric_count: 5, available_core_metric_count: 5, metric_coverage_rate: 1,
      facebook_share_quality_status: "needs_review", facebook_share_quality_note: "Preserve provider value",
      facebook_reaction_definition_status: "needs_review", instagram_interaction_definition_status: "not_applicable",
      data_quality_status: "needs_review", analysis_status: "exposure_ready_without_reach",
    }],
    metricCoverage: [{
      provider: "meta", platform: "facebook", metric_key: "views", native_metric_key: "facebook.views",
      total_posts: 1, eligible_posts: 1, available_posts: 1, not_returned_posts: 0, not_fetched_posts: 0,
      unsupported_posts: 0, not_requested_posts: 0, permission_denied_posts: 0, rate_limited_posts: 0,
      fetch_error_posts: 0, availability_rate: 1,
    }],
  });
  assert.deepEqual(sheets.map((sheet) => sheet.title), [
    "Content", "Publications", "Marketing - Posts", "Marketing - Coverage", "Marketing - QA",
    "Facebook - Comments", "Facebook - Reactions",
  ]);
  assert.equal(sheets[0]?.rows[1]?.[9], "=not-a-formula");
  assert.equal(sheets[2]?.rows[1]?.[12], "=not-a-formula");
  assert.equal(sheets[3]?.rows[1]?.[14], 1);
  assert.equal(sheets[4]?.rows.length, 2);
  assert.equal(sheets[5]?.rows.length, 2);
});

test("Sheets REST uses one memory-only drive.file token, blocks redirects and never writes it into a request body", async () => {
  const calls: Array<{ url: string; authorization: string; body: string; redirect: RequestRedirect | undefined }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), authorization: String(new Headers(init?.headers).get("authorization")), body: String(init?.body ?? ""), redirect: init?.redirect });
    return calls.length === 1
      ? new Response(JSON.stringify({ spreadsheetId: "sheet_export_20260901" }), { status: 200 })
      : new Response("{}", { status: 200 });
  };
  const result = await createSocialGoogleSpreadsheet({
    accessToken: "synthetic_access_token_never_persist",
    authorization,
    sheets: [{ title: "Content", rows: [["id"], ["content:1"]] }, { title: "Publications", rows: [["id"]] }],
    nowMs: now.getTime(),
    fetcher,
  });
  assert.equal(result.spreadsheetUrl, "https://docs.google.com/spreadsheets/d/sheet_export_20260901/edit");
  assert.ok(calls.every((call) => call.authorization === "Bearer synthetic_access_token_never_persist"));
  assert.ok(calls.every((call) => !call.body.includes("synthetic_access_token_never_persist")));
  assert.ok(calls.every((call) => call.redirect === "error"));
  assert.match(calls[1]!.url, /valueInputOption=RAW$/);
});

test("Sheets export rejects expired interactive authorization before any Google call", async () => {
  let called = false;
  await assert.rejects(() => createSocialGoogleSpreadsheet({
    accessToken: "synthetic_access_token",
    authorization: { ...authorization, expiresAtMs: now.getTime() },
    sheets: [{ title: "Content", rows: [["id"]] }, { title: "Publications", rows: [["id"]] }],
    nowMs: now.getTime(),
    fetcher: async () => { called = true; return new Response(); },
  }), /GOOGLE_SHEETS_AUTH_REQUIRED/);
  assert.equal(called, false);
});

test("Legacy direct Sheets route stays guarded while Social UI uses the central Export Center", () => {
  const route = readFileSync(new URL("../../app/api/admin/social/export/sheets/route.ts", import.meta.url), "utf8");
  const service = readFileSync(new URL("../../lib/admin/social/sheets-export.ts", import.meta.url), "utf8");
  const component = readFileSync(new URL("../../features/admin/social/SocialSheetsExport.tsx", import.meta.url), "utf8");
  assert.match(route, /identity\.actorType !== "human" \|\| identity\.role !== "owner"/);
  assert.match(route, /isConfiguredAdminOrigin/);
  assert.match(route, /isSameOriginAdminMutation/);
  assert.match(service, /post_performance_clean/);
  assert.match(service, /post_metric_coverage_summary/);
  assert.match(component, /\/analytics\/exports\//);
  assert.match(component, /Agent OS \+ n8n/);
  assert.doesNotMatch(component, /\/api\/admin\/social\/export\/sheets/);
  assert.doesNotMatch(route, /console\./);
  assert.doesNotMatch(service, /console\./);
});
