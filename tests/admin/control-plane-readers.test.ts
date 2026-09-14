import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("Deployments page uses exact runtime SHA plus GitHub deployment metadata without a Vercel token", () => {
  const source = read("lib/admin/operations/deployment-read-model.ts");
  assert.match(source, /VERCEL_GIT_COMMIT_SHA/);
  assert.match(source, /Production – ccpun-admin/);
  assert.match(source, /statuses_url/);
  assert.match(source, /admin\.ccpun\.com/);
  assert.doesNotMatch(source, /VERCEL_TOKEN|Authorization:\s*[`'\"]/i);
});

test("Operations Jobs read model is SELECT-only and verifies both durable data-plane identities", () => {
  const source = read("lib/admin/operations/jobs-read-model.ts");
  assert.match(source, /resolveArticleSchedulerLane/);
  assert.match(source, /article_scheduler_identity/);
  assert.match(source, /getSocialDatabaseReadiness/);
  assert.match(source, /ccpun_social\.system_identity/);
  assert.match(source, /social_publication_job/);
  assert.doesNotMatch(source, /\b(?:INSERT|UPDATE|DELETE|TRUNCATE|ALTER|DROP)\b/i);
});

test("Operations routes render real Deployments and Jobs readers instead of not-configured placeholders", () => {
  const route = read("app/(control-plane)/operations/[section]/page.tsx");
  assert.match(route, /AdminDeploymentsPage/);
  assert.match(route, /AdminJobsPage/);
  assert.doesNotMatch(route, /not-configured|ยังไม่มี server-side deployment reader|ยังไม่มี read adapter รวม/);
});

test("Jobs UI stays read-only and exposes no execute retry cancel controls", () => {
  const source = read("features/admin/operations/JobsPage.tsx");
  assert.match(source, /แบบอ่านอย่างเดียว/);
  assert.match(source, /ไม่มีปุ่ม execute \/ retry \/ cancel/);
  assert.doesNotMatch(source, /onClick=|<form|method=/i);
});
