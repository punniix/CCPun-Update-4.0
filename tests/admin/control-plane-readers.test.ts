import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("Deployments reader uses neutral runtime identity with separate Hostinger and retained Vercel evidence without a token", () => {
  const source = read("lib/admin/operations/deployment-read-model.ts");
  assert.match(source, /resolveDeploymentIdentity\(env, "admin"\)/);
  assert.match(source, /identity\.provider === "hostinger"/);
  assert.match(source, /admin-test\.ccpun\.com/);
  assert.match(source, /check-runs\?per_page=100/);
  assert.match(source, /identity\.provider === "vercel"/);
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
  assert.match(source, /หน้านี้ดูข้อมูลได้อย่างเดียว/);
  assert.match(source, /ไม่มีปุ่มสั่งทำซ้ำหรือยกเลิกงาน/);
  assert.doesNotMatch(source, /onClick=|<form|method=/i);
});
