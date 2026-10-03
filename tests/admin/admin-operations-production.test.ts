import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { DeploymentReadModel } from "../../lib/admin/operations/deployment-read-model";
import {
  ADMIN_OPERATIONS_PRODUCTION_MIGRATION_CHECKSUM,
  ADMIN_OPERATIONS_PRODUCTION_MIGRATION_VERSION,
  isAdminOperationsRuntimeIdentityValid,
} from "../../lib/admin/operations/foundation";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("Production Admin operations migration is checksum locked and preserves scheduler grants", () => {
  const migration = read("db/migrations/20260913_admin_operations_production_v1.sql");
  const source = migration.split("-- checksum-source-begin\n")[1]?.split("-- checksum-source-end")[0];
  assert.ok(source);
  assert.equal(`sha256:${createHash("sha256").update(source).digest("hex")}`, ADMIN_OPERATIONS_PRODUCTION_MIGRATION_CHECKSUM);
  assert.match(migration, new RegExp(ADMIN_OPERATIONS_PRODUCTION_MIGRATION_VERSION));
  for (const identity of ["lively-bar-43618798", "br-long-resonance-b3ys5xrv", "ep-broad-butterfly-b3ro7u8w", "neondb"]) {
    assert.match(migration, new RegExp(identity));
  }
  for (const table of ["audit_log", "research_snapshot", "seo_suggestion", "system_identity", "schema_migration"]) {
    assert.match(migration, new RegExp(`ccpun_admin\\.${table}`));
  }
  assert.match(migration, /GRANT SELECT, INSERT ON ccpun_admin\.audit_log, ccpun_admin\.research_snapshot TO ccpun_admin_runtime/);
  assert.match(migration, /GRANT UPDATE \([\s\S]*\) ON ccpun_admin\.seo_suggestion TO ccpun_admin_runtime/);
  assert.doesNotMatch(migration, /REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA ccpun_admin FROM ccpun_admin_runtime/);
  assert.doesNotMatch(migration, /REVOKE[^;]*article_schedule[^;]*FROM ccpun_admin_runtime/);
});

test("Production Admin operations readback verifies scheduler coexistence", () => {
  const readback = read("db/migrations/20260913_admin_operations_production_v1_readback.sql");
  assert.match(readback, new RegExp(ADMIN_OPERATIONS_PRODUCTION_MIGRATION_CHECKSUM.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(readback, /AS scheduler_grants_preserved/);
  assert.match(readback, /table_name = 'article_schedule'/);
  assert.match(readback, /AS social_objects_denied/);
  assert.match(readback, /AS seo_update_columns_ok/);
});

test("runtime identity accepts only the exact Production Admin lane", () => {
  const valid = {
    environment: "production-admin",
    projectId: "lively-bar-43618798",
    branchId: "br-long-resonance-b3ys5xrv",
    database: "neondb",
    connectionString: "postgresql://ccpun_admin_runtime:secret@ep-broad-butterfly-b3ro7u8w.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
    vercelEnvironment: "production",
    gitBranch: "v4-production",
    vercelProjectId: "prj_6tuUxJxYbQ4mpF7sMgNWx2p2jowN",
    productionAdminProjectId: "prj_6tuUxJxYbQ4mpF7sMgNWx2p2jowN",
  };
  assert.equal(isAdminOperationsRuntimeIdentityValid(valid), true);
  for (const changed of [
    { environment: "admin-uat" },
    { projectId: "young-term-47483330" },
    { branchId: "br-crimson-mouse-az7ajkv8" },
    { vercelEnvironment: "preview" },
    { gitBranch: "feature/admin" },
    { vercelProjectId: "prj_other" },
    { vercelProjectId: undefined },
    { connectionString: "postgresql://ccpun_admin_runtime:secret@ep-mute-frost-aztvz394.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require" },
    { connectionString: "postgresql://neondb_owner:secret@ep-broad-butterfly-b3ro7u8w.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require" },
  ]) assert.equal(isAdminOperationsRuntimeIdentityValid({ ...valid, ...changed }), false);
});

test("Production legacy backfill is dry-run by default and exact-source guarded", () => {
  const script = read("scripts/backfill-production-sanity-admin-operations.ts");
  assert.match(script, /projectId: "kyfxgjnq", dataset: "production"/);
  assert.match(script, /projectId: "lively-bar-43618798"/);
  assert.match(script, /branchId: "br-long-resonance-b3ys5xrv"/);
  assert.match(script, /endpointId: "ep-broad-butterfly-b3ro7u8w"/);
  assert.match(script, /const apply = process\.argv\.includes\("--apply"\)/);
  assert.match(script, /--expect-source-digest=/);
  assert.match(script, /CCPUN_APP_ENV !== "local-production"/);
  assert.match(script, /CCPUN_ADMIN_BACKFILL_DATABASE_URL/);
  assert.match(script, /\["neondb_owner", "cloud_admin"\]/);
  assert.match(script, /refuses ccpun_admin_runtime/);
  assert.match(script, /scheduler_grants_preserved/);
  assert.match(script, /prepareBackfillInsert/);
  assert.doesNotMatch(script, /SANITY_API_WRITE_TOKEN/);
});

test("owner-facing Admin surfaces health and explicit SEO re-audit", () => {
  const layout = read("app/(control-plane)/layout.tsx");
  const health = read("app/(control-plane)/operations/health/page.tsx");
  const audit = read("app/(control-plane)/operations/audit-log/page.tsx");
  const button = read("features/admin/components/RunSeoAuditButton.tsx");
  assert.match(layout, /\/operations\/health\//);
  assert.match(layout, /permission: "settings:read"/);
  assert.match(health, /สถานะเวอร์ชันระบบ/);
  assert.match(health, /getAdminDeploymentIdentity/);
  assert.match(health, /ยังไม่ใช่ผลตรวจเว็บสาธารณะ HTTPS/);
  assert.doesNotMatch(health, /Vercel Runtime|process\.env\.VERCEL_/);
  assert.match(health, /Control Plane Operations/);
  assert.match(audit, /ฐานข้อมูล Control Plane/);
  assert.match(button, /ตรวจ SEO อีกครั้ง/);
});

const deploymentSha = "a".repeat(40);
const githubRoot = "https://api.github.com/repos/punniix/CCPun-Update-4.0";
const checkUrl = `${githubRoot}/commits/${deploymentSha}/check-runs?per_page=100`;
const hostingerRelease = {
  CCPUN_DEPLOYMENT_PROVIDER: "hostinger", CCPUN_DEPLOYMENT_ROLE: "admin", CCPUN_APP_ENV: "admin-uat",
  CCPUN_GIT_SHA: deploymentSha, CCPUN_GIT_REF: "v4-production", CCPUN_RELEASE_ID: "synthetic-uat-release",
};

function deploymentProbe(host: string, env: Record<string, string | undefined>, responses: Record<string, unknown> = {}) {
  const script = `
    const Module=require('node:module'); const load=Module._load;
    Module._load=function(name,...args){if(name==='server-only')return {};return load.call(this,name,...args)};
    const responses=${JSON.stringify(responses)}; const calls=[];
    global.fetch=async(url)=>{
      calls.push(url);
      if(!Object.hasOwn(responses,url))throw Error('UNEXPECTED_NETWORK');
      const data=responses[url]; const status=typeof data==='number'?data:200;
      return {ok:status===200,status,async json(){return data}};
    };
    require('./lib/admin/operations/deployment-read-model.ts').readAdminDeployments(${JSON.stringify(host)},${JSON.stringify(env)})
      .then(model=>process.stdout.write(JSON.stringify({model,calls}))).catch(()=>process.exit(1));
  `;
  const result = spawnSync(process.execPath, ["--import", "tsx", "-e", script], {
    cwd: new URL("../../", import.meta.url), encoding: "utf8", env: { PATH: process.env.PATH, NODE_ENV: "test" },
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout) as { model: DeploymentReadModel; calls: string[] };
}

const githubCheck = (change: Record<string, unknown> = {}) => ({
  name: "verify", head_sha: deploymentSha, status: "completed", conclusion: "success",
  completed_at: "2026-10-03T04:31:38Z", app: { slug: "github-actions" }, ...change,
});

test("Hostinger reads exact-SHA GitHub checks without treating CI or Vercel records as deployment proof", () => {
  const { model, calls } = deploymentProbe("admin-test.ccpun.com", hostingerRelease, {
    [checkUrl]: { check_runs: [githubCheck(), githubCheck({ head_sha: "b".repeat(40) }), githubCheck({ app: { slug: "vercel" } })] },
  });
  assert.deepEqual(calls, [checkUrl]);
  assert.equal(model.provider, "hostinger"); assert.equal(model.environment, "admin-uat");
  assert.equal(model.canonicalHost, "admin-test.ccpun.com"); assert.equal(model.canonicalHostMatched, true);
  assert.equal(model.gitSha, deploymentSha); assert.equal(model.releaseId, "synthetic-uat-release");
  assert.equal(model.runtimeIdentityValid, true); assert.equal(model.status, "partial");
  assert.equal(model.vercelEnvironment, null); assert.equal(model.exactShaProduction, null);
  assert.deepEqual(model.history, []); assert.equal(model.githubChecks.length, 1);
  assert.equal(model.githubChecks[0].state, "success");
  const production = deploymentProbe("admin.ccpun.com", { ...hostingerRelease, CCPUN_APP_ENV: "production-admin" }, { [checkUrl]: { check_runs: [] } });
  assert.equal(production.model.canonicalHost, "admin.ccpun.com"); assert.equal(production.model.status, "partial");
});

test("Hostinger fails closed on invalid release identity and preserves incomplete or failed external checks", () => {
  for (const changed of [
    { CCPUN_DEPLOYMENT_ROLE: "web" }, { CCPUN_GIT_SHA: "invalid" }, { CCPUN_RELEASE_ID: undefined },
    { VERCEL_PROJECT_ID: "prj_6tuUxJxYbQ4mpF7sMgNWx2p2jowN" }, { NEXT_PUBLIC_CCPUN_GIT_SHA: "b".repeat(40) },
  ]) {
    const { model, calls } = deploymentProbe("admin-test.ccpun.com", { ...hostingerRelease, ...changed });
    assert.equal(model.status, "unavailable"); assert.deepEqual(calls, []);
  }
  const unavailable = deploymentProbe("admin-test.ccpun.com", hostingerRelease, { [checkUrl]: 403 });
  assert.equal(unavailable.model.status, "partial"); assert.equal(unavailable.model.error, "github-403");
  assert.deepEqual(unavailable.model.githubChecks, []);
  const failed = deploymentProbe("admin-test.ccpun.com", hostingerRelease, { [checkUrl]: {
    check_runs: [githubCheck({ conclusion: "failure" }), githubCheck({ name: "admin-shadow", status: "queued", conclusion: null, completed_at: null })],
  } });
  assert.equal(failed.model.status, "partial");
  assert.deepEqual(failed.model.githubChecks.map((check) => check.state), ["failure", "queued"]);
});

test("Vercel migration fallback retains matching Production deployment evidence", () => {
  const statusesUrl = `${githubRoot}/deployments/123/statuses`;
  const { model, calls } = deploymentProbe("admin.ccpun.com", {
    VERCEL_PROJECT_ID: "prj_6tuUxJxYbQ4mpF7sMgNWx2p2jowN", VERCEL_ENV: "production",
    VERCEL_GIT_COMMIT_SHA: deploymentSha, VERCEL_GIT_COMMIT_REF: "v4-production",
  }, {
    [`${githubRoot}/deployments?per_page=40`]: [{ id: 123, environment: "Production – ccpun-admin", sha: deploymentSha, ref: "v4-production", created_at: "2026-10-03T04:31:38Z", statuses_url: statusesUrl }],
    [statusesUrl]: [{ state: "success", created_at: "2026-10-03T04:31:38Z" }],
  });
  assert.deepEqual(calls, [`${githubRoot}/deployments?per_page=40`, statusesUrl]);
  assert.equal(model.provider, "vercel"); assert.equal(model.status, "ready");
  assert.equal(model.exactShaProduction?.id, 123); assert.deepEqual(model.githubChecks, []);
});
