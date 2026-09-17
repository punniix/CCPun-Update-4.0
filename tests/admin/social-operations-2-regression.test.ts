import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("Admin navigation keeps seven primary modules and exposes Social contextually", () => {
  const layout = read("apps/admin/app/(control-plane)/layout.tsx");
  const nav = read("features/admin/components/AdminNavigation.tsx");
  for (const label of ["Dashboard", "Content", "SEO", "Social", "Analytics", "Operations", "Settings"]) {
    assert.ok(layout.includes(`label: "${label}"`), `missing primary module ${label}`);
  }
  assert.match(layout, /href: "\/social\/queue\/", label: "Queue"/);
  assert.match(nav, /<PrimaryModules items=\{items\} pathname=\{pathname\} \/>/);
  assert.match(nav, /activeItem\?\.children\?\.length \? <ContextNavigation/);
  assert.match(nav, /aria-label="กลับไปเมนูหลัก"/);
  assert.match(nav, /min-h-11 min-w-11/);
  assert.match(nav, /motion-reduce:transition-none/);
});

test("Calendar and Queue are operational Social surfaces rather than aliases", () => {
  const calendarPage = read("features/admin/social/calendar-page.tsx");
  const calendarClient = read("features/admin/social/SocialOperationalCalendar.tsx");
  const operationClient = read("features/admin/social/social-operation-client.ts");
  const queuePage = read("features/admin/social/operations-page.tsx");
  const queueClient = read("features/admin/social/SocialQueueClient.tsx");
  const postsPage = read("apps/admin/app/(control-plane)/social/posts/page.tsx");
  assert.match(calendarPage, /SocialOperationalCalendar/);
  assert.match(calendarClient, /Asia\/Bangkok/);
  assert.match(calendarClient, /rescheduleSocialPublication/);
  assert.match(operationClient, /\/api\/admin\/social\/publications\/reschedule\//);
  assert.match(calendarClient, /draggable/);
  assert.match(queuePage, /SocialQueueClient/);
  assert.match(queueClient, /Execute now|Execute Now/);
  assert.match(queueClient, /Reschedule/);
  assert.doesNotMatch(postsPage, /operations-page/);
});

test("reschedule and cancel mutate only the latest publication job with CAS", () => {
  const service = read("lib/admin/social/operations-service.ts");
  const latestJobJoin = /JOIN LATERAL \(\s*SELECT \* FROM ccpun_social\.social_publication_job\s*WHERE publication_id=publication\.id ORDER BY created_at DESC,id DESC LIMIT 1(?: FOR UPDATE)?\s*\) AS job ON true/g;
  const matches = service.match(latestJobJoin) ?? [];
  assert.ok(matches.length >= 4, `expected latest-job selection for reads + both mutations, got ${matches.length}`);
  assert.ok((service.match(/LIMIT 1 FOR UPDATE/g) ?? []).length >= 2, "both amendment mutations must row-lock the latest job");
  assert.ok((service.match(/FOR UPDATE OF publication/g) ?? []).length >= 2, "both amendment mutations must lock publication state");
  assert.match(service, /job\.version=\$2/);
  assert.match(service, /version=version\+1/);
  assert.match(service, /ON CONFLICT \(id\) DO NOTHING/);
  assert.match(service, /SOCIAL_OPERATION_CAS_CONFLICT/);
});

test("worker remains approval-gated, bounded and fail-closed for ambiguous provider state", () => {
  const worker = read("lib/admin/social/worker.ts");
  const execution = read("lib/admin/social/execution-store.ts");
  const publishing = read("lib/admin/social/publishing.ts");
  const workerRoute = read("apps/admin/app/api/admin/social/worker/route.ts");
  assert.match(worker, /MAX_JOBS_PER_RUN = 6/);
  assert.match(worker, /BASE_RETRY_DELAY_MS = 30_000/);
  assert.match(worker, /2 \*\* Math\.max/);
  assert.match(worker, /AUTO_EXECUTABLE_FORMATS = new Set\(\["text-post", "link-post"\]\)/);
  assert.match(publishing, /approvedByActorType: z\.literal\("human"\)/);
  assert.match(execution, /SOCIAL_EXECUTION_RECONCILIATION_REQUIRED/);
  assert.match(execution, /SOCIAL_EXECUTION_TRUSTED_MEDIA_REQUIRED/);
  assert.match(workerRoute, /CRON_SECRET/);
});

test("execution audit schema accepts worker execution records without widening the trust model", () => {
  const migration = read("db/migrations/20260828_website_42_social_foundation_v2.sql");
  const execution = read("lib/admin/social/execution-store.ts");
  assert.match(migration, /actor_type IN \('human', 'system'\)/);
  assert.match(execution, /actor_type,actor_ref,action,object_type,object_id,request_ref,outcome/);
  assert.match(execution, /'human'/);
});

test("Instagram audio configuration is revision-bound and preview URLs are not persisted", () => {
  const schema = read("cms/sanity/schema/documents/social-variant.ts");
  const audio = read("lib/admin/social/instagram-audio-config.ts");
  const route = read("apps/admin/app/api/admin/social/drafts/instagram-audio/route.ts");
  assert.match(schema, /instagramAudio/);
  assert.match(audio, /audioId/);
  assert.match(audio, /videoVolume/);
  assert.match(audio, /audioVolume/);
  assert.match(audio, /revalidateInstagramAudioConfiguration/);
  assert.match(audio, /ifRevisionId\(mutation\.expectedRevision\)/);
  assert.match(route, /instagramAudioConfigurationMutationSchema/);
  assert.match(route, /saveSocialInstagramAudioConfiguration/);
  assert.doesNotMatch(schema, /previewUrl|downloadUrl/);
});

test("media accessibility metadata stays in Sanity editorial state", () => {
  const schema = read("cms/sanity/schema/documents/social-variant.ts");
  const drafts = read("lib/admin/social/drafts.ts");
  const panel = read("features/admin/social/SocialMediaMetadataPanel.tsx");
  assert.match(schema, /altText/);
  assert.match(schema, /thumbnailTimestampMs/);
  assert.match(drafts, /altText/);
  assert.match(drafts, /thumbnailTimestampMs/);
  assert.match(panel, /expectedRevision/);
});
