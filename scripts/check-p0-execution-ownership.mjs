import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const adminVercel = JSON.parse(read("apps/admin/vercel.json"));
const socialHttp = read("apps/admin/app/api/admin/social/worker/route.ts");
const richMenuHttp = read("apps/admin/app/api/internal/line/rich-menu/reconcile/route.ts");
const privateBackground = read("scripts/admin-background-worker.ts");
const privateArticle = read("scripts/article-schedule-worker.ts");
const adminBuild = read("apps/admin/scripts/build-provider.mjs");
const lineRecovery = read(".github/workflows/line-key-recovery-once.yml");
const vercelAudit = read(".github/workflows/vercel-monorepo-migration-audit.yml");

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

assert.match(lineRecovery, /workflow_dispatch:/);
assert.doesNotMatch(lineRecovery, /\nschedule:/);
assert.match(lineRecovery, /inputs\.approval == 'APPROVE_TEMPORARY_LINE_RECOVERY_PUBLIC_SIGNED_ENDPOINT'/);

assert.match(vercelAudit, /workflow_dispatch:/);
assert.doesNotMatch(vercelAudit, /\nschedule:/);

console.log(JSON.stringify({
  status: "locked",
  autonomousCloudExecutors: 0,
  vercelOperationalCrons: 0,
  authorizedExecutionPlane: "private-vps-cli-only",
  activationState: "production-accepted-private-vps",
}));
