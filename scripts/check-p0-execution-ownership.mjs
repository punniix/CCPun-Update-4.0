import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const adminVercel = JSON.parse(read("apps/admin/vercel.json"));
const socialHttp = read("apps/admin/app/api/admin/social/worker/route.ts");
const richMenuHttp = read("apps/admin/app/api/internal/line/rich-menu/reconcile/route.ts");
const privateBackground = read("scripts/admin-background-worker.ts");
const privateArticle = read("scripts/article-schedule-worker.ts");
const adminBuild = read("apps/admin/scripts/build-provider.mjs");
const retiredVercelArtifacts = [
  ".github/workflows/line-key-recovery-once.yml",
  ".github/workflows/vercel-monorepo-migration-audit.yml",
  "scripts/operator/web-line-recovery.cjs",
  "scripts/operator/web-line-recovery.test.cjs",
  "scripts/operator/web-line-recovery-workflow.test.mjs",
];

assert.equal(Object.hasOwn(adminVercel, "crons"), false, "Vercel Admin must not own operational crons");

assert.match(socialHttp, /social-worker-unavailable/);
assert.doesNotMatch(socialHttp, /runSocialWorker|executeSocialPublication|lib\/admin\/social\/worker/);

assert.match(richMenuHttp, /rich-menu-reconciler-unavailable/);
assert.doesNotMatch(richMenuHttp, /reconcileDesiredLineRichMenu|@\/lib\/admin\/line\/rich-menu-reconciler/);

assert.match(privateBackground, /CCPUN_BACKGROUND_EXECUTION_PLANE !== "vps"/);
assert.match(privateBackground, /CCPUN_BACKGROUND_WORKER_ENABLED !== "1"/);
assert.match(privateBackground, /key\.startsWith\("VERCEL_"\)/);
assert.match(privateBackground, /\["social", "line-rich-menu"\]/);

assert.match(privateArticle, /Private VPS process only/);
assert.match(privateArticle, /isArticleScheduleExecutionEnabled/);
assert.match(privateArticle, /validateNativeNeonSource/);

for (const expected of [
  /CCPUN_ARTICLE_SCHEDULE_EXECUTOR_ENABLED:\s*"0"/,
  /CCPUN_NATIVE_WORKFLOW_ENABLED:\s*"0"/,
  /CCPUN_BACKGROUND_WORKER_ENABLED:\s*"0"/,
]) assert.match(adminBuild, expected);

for (const path of retiredVercelArtifacts) {
  assert.equal(existsSync(new URL(`../${path}`, import.meta.url)), false, `${path} must stay retired after permanent Vercel deletion`);
}

console.log(JSON.stringify({
  status: "locked",
  autonomousCloudExecutors: 0,
  vercelOperationalCrons: 0,
  authorizedExecutionPlane: "private-vps-cli-only",
  activationState: "production-accepted-private-vps",
}));
