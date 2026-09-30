import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import test from "node:test";
import { resolveLineIngestRuntime } from "../../lib/admin/line/private-ingestion";
import {
  ADMIN_OPERATIONS_LANES,
  resolveAdminOperationsRuntimeIdentity,
} from "../../lib/admin/operations/foundation";

const productionDb = "postgresql://ccpun_admin_runtime:TEST_ONLY@ep-broad-butterfly-b3ro7u8w.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

test("Admin LINE ingestion accepts explicit Hostinger production identity and exact Neon lane", () => {
  const runtime = resolveLineIngestRuntime({
    CCPUN_DEPLOYMENT_PROVIDER: "hostinger",
    CCPUN_DEPLOYMENT_ROLE: "admin",
    CCPUN_APP_ENV: "production-admin",
    CCPUN_GIT_REF: "v4-production",
    CCPUN_NEON_PROJECT_ID: "lively-bar-43618798",
    CCPUN_NEON_BRANCH_ID: "br-long-resonance-b3ys5xrv",
    CCPUN_NEON_DATABASE: "neondb",
    CCPUN_ADMIN_DATABASE_URL: productionDb,
  });
  assert.equal(runtime?.lane, "production");
  assert.equal(runtime?.provider, "hostinger");
});

test("Admin Operations accepts Hostinger production identity while preserving exact Neon identity", () => {
  const identity = ADMIN_OPERATIONS_LANES.production;
  const runtime = resolveAdminOperationsRuntimeIdentity({
    environment: "production-admin",
    projectId: identity.projectId,
    branchId: identity.branchId,
    database: identity.database,
    connectionString: `postgresql://${identity.runtimeRole}:TEST_ONLY@${identity.endpointId}.${identity.hostSuffix}/${identity.database}?sslmode=require`,
    deploymentProvider: "hostinger",
    deploymentRole: "admin",
    gitBranch: "v4-production",
  });
  assert.equal(runtime?.lane, "production");

  assert.equal(resolveAdminOperationsRuntimeIdentity({
    environment: "production-admin",
    projectId: identity.projectId,
    branchId: identity.branchId,
    database: identity.database,
    connectionString: `postgresql://${identity.runtimeRole}:TEST_ONLY@${identity.endpointId}.${identity.hostSuffix}/${identity.database}?sslmode=require`,
    deploymentProvider: "hostinger",
    deploymentRole: "web",
    gitBranch: "v4-production",
  }), null);
});

test("Admin LINE ingestion remains fail closed for wrong role or production ref", () => {
  const base = {
    CCPUN_DEPLOYMENT_PROVIDER: "hostinger",
    CCPUN_DEPLOYMENT_ROLE: "admin",
    CCPUN_APP_ENV: "production-admin",
    CCPUN_GIT_REF: "v4-production",
    CCPUN_NEON_PROJECT_ID: "lively-bar-43618798",
    CCPUN_NEON_BRANCH_ID: "br-long-resonance-b3ys5xrv",
    CCPUN_NEON_DATABASE: "neondb",
    CCPUN_ADMIN_DATABASE_URL: productionDb,
  };
  assert.equal(resolveLineIngestRuntime({ ...base, CCPUN_DEPLOYMENT_ROLE: "web" }), null);
  assert.equal(resolveLineIngestRuntime({ ...base, CCPUN_GIT_REF: "feature/not-production" }), null);
});

function workerProbe(variables: Record<string, string | undefined>, outboundId = "11111111-1111-4111-8111-111111111111") {
  const script = `
    const Module=require('node:module');const load=Module._load;
    let connections=0;const queries=[];let outbound,richMenu;
    Module._load=function(name,...args){
      if(name==='server-only')return {};
      if(name==='@neondatabase/serverless')return {neon(){connections++;return {async query(statement,params){queries.push({statement,payload:JSON.parse(params[0])});return [];}}}};
      return load.call(this,name,...args);
    };
    global.fetch=()=>{throw Error('UNEXPECTED_NETWORK')};
    const line=require('./lib/admin/line/control-plane.ts');
    const rich=require('./lib/admin/control-plane/provider-state.ts');
    const variables=JSON.parse(process.argv[1]);
    (async()=>{
      try{const value=line.lineWorkerDigest(process.argv[2],variables);await line.claimLineSystemOutbound(process.argv[2],value,'a'.repeat(64),variables);outbound={value};}catch(error){outbound={error:error.message};}
      try{await rich.claimLineRichMenuOperation(variables);richMenu={};}catch(error){richMenu={error:error.message};}
      console.log(JSON.stringify({outbound,richMenu,connections,queries}));
    })().catch(()=>process.exit(1));
  `;
  const result = spawnSync(process.execPath, ["--import", "tsx", "-e", script, JSON.stringify(variables), outboundId], {
    encoding: "utf8", timeout: 15_000, env: { PATH: process.env.PATH, NODE_ENV: "test" },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout) as {
    outbound: { value?: string; error?: string }; richMenu: { error?: string };
    connections: number; queries: Array<{ statement: string; payload: Record<string, string> }>;
  };
}

function nativeWorkerVariables(environment: "admin-uat" | "production-admin" = "admin-uat") {
  const lane = ADMIN_OPERATIONS_LANES[environment === "production-admin" ? "production" : "uat"];
  return {
    CCPUN_DEPLOYMENT_PROVIDER: "hostinger", CCPUN_DEPLOYMENT_ROLE: "admin", CCPUN_APP_ENV: environment,
    CCPUN_GIT_REF: environment === "production-admin" ? "v4-production" : "codex/native-uat",
    CCPUN_GIT_SHA: "a".repeat(40), CCPUN_RELEASE_ID: "native-release-one",
    CCPUN_NEON_PROJECT_ID: lane.projectId, CCPUN_NEON_BRANCH_ID: lane.branchId, CCPUN_NEON_DATABASE: lane.database,
    CCPUN_ADMIN_DATABASE_URL: `postgresql://${lane.runtimeRole}:TEST_ONLY@${lane.endpointId}.${lane.hostSuffix}/${lane.database}?sslmode=require`,
  };
}

test("native worker claims bind real Admin releases while keeping outbound capability and rich-menu lease payloads", () => {
  const base = nativeWorkerVariables();
  const first = workerProbe(base);
  const same = workerProbe(base);
  const next = workerProbe({ ...base, CCPUN_GIT_SHA: "b".repeat(40), CCPUN_RELEASE_ID: "native-release-two" });
  const sameReleaseNewSha = workerProbe({ ...base, CCPUN_GIT_SHA: "b".repeat(40) });
  const sameShaNewRelease = workerProbe({ ...base, CCPUN_RELEASE_ID: "native-release-two" });
  const nextOutbound = workerProbe(base, "22222222-2222-4222-8222-222222222222");
  for (const result of [first, same, next, sameReleaseNewSha, sameShaNewRelease, nextOutbound, workerProbe(nativeWorkerVariables("production-admin"))]) {
    assert.equal(result.outbound.error, undefined);
    assert.equal(result.richMenu.error, undefined);
    assert.equal(result.connections, 2);
    assert.equal(result.queries.length, 2);
    assert.match(result.queries[0].statement, /admin_claim_line_system_outbound/);
    assert.deepEqual(Object.keys(result.queries[0].payload).sort(), ["dispatch_token_digest", "outbound_id", "worker_digest"]);
    assert.equal(result.queries[0].payload.dispatch_token_digest, "a".repeat(64));
    assert.equal(result.queries[0].payload.worker_digest, result.outbound.value);
    assert.match(result.queries[1].statement, /admin_claim_provider_operation/);
    assert.deepEqual(Object.keys(result.queries[1].payload).sort(), ["lease_token_digest", "resource_key", "worker_digest"]);
    assert.equal(result.queries[1].payload.resource_key, "line.rich_menu.default");
    assert.match(result.queries[1].payload.lease_token_digest, /^[0-9a-f]{64}$/);
  }
  assert.equal(first.outbound.value, same.outbound.value);
  assert.equal(first.queries[1].payload.worker_digest, same.queries[1].payload.worker_digest);
  for (const result of [next, sameReleaseNewSha, sameShaNewRelease]) {
    assert.notEqual(first.outbound.value, result.outbound.value);
    assert.notEqual(first.queries[1].payload.worker_digest, result.queries[1].payload.worker_digest);
  }
  assert.notEqual(first.outbound.value, nextOutbound.outbound.value);
  assert.equal(first.queries[1].payload.worker_digest, nextOutbound.queries[1].payload.worker_digest);
});

test("invalid native worker metadata fails before SQL connection/claim or network", () => {
  const base = nativeWorkerVariables();
  for (const patch of [
    { CCPUN_DEPLOYMENT_ROLE: "web" }, { CCPUN_DEPLOYMENT_ROLE: undefined },
    { CCPUN_APP_ENV: undefined }, { CCPUN_APP_ENV: "development" }, { CCPUN_APP_ENV: "production" },
    { CCPUN_APP_ENV: "production-admin", CCPUN_GIT_REF: "feature/not-production" },
    { CCPUN_GIT_REF: undefined }, { CCPUN_GIT_REF: " " }, { CCPUN_GIT_SHA: undefined },
    { CCPUN_GIT_SHA: "not-a-sha" }, { CCPUN_GIT_SHA: "a".repeat(39) }, { CCPUN_GIT_SHA: "g".repeat(40) },
    { CCPUN_RELEASE_ID: undefined }, { CCPUN_RELEASE_ID: " " },
    { VERCEL_PROJECT_ID: "conflicting-project" },
    { CCPUN_GIT_SHA: undefined, VERCEL_GIT_COMMIT_SHA: "b".repeat(40) },
    { CCPUN_RELEASE_ID: undefined, VERCEL_URL: "candidate.vercel.app" },
  ]) {
    const result = workerProbe({ ...base, ...patch });
    assert.equal(result.outbound.error, "LINE_WORKER_IDENTITY_INVALID", JSON.stringify(patch));
    assert.equal(result.richMenu.error, "CONTROL_PLANE_WORKER_IDENTITY_INVALID", JSON.stringify(patch));
    assert.equal(result.connections, 0);
    assert.deepEqual(result.queries, []);
  }
});

test("legacy Vercel worker digests remain byte-identical including trim and missing-value behavior", () => {
  const base = nativeWorkerVariables("production-admin");
  const vercel = {
    ...base, CCPUN_DEPLOYMENT_PROVIDER: "vercel", VERCEL_ENV: "production",
    VERCEL_PROJECT_ID: "prj_6tuUxJxYbQ4mpF7sMgNWx2p2jowN",
  };
  for (const values of [{ VERCEL_DEPLOYMENT_ID: " dpl-original ", VERCEL_REGION: "sin1" }, {}, { VERCEL_DEPLOYMENT_ID: "", VERCEL_REGION: "" }]) {
    const result = workerProbe({ ...vercel, ...values });
    const deploymentId = "VERCEL_DEPLOYMENT_ID" in values ? values.VERCEL_DEPLOYMENT_ID : undefined;
    const region = "VERCEL_REGION" in values ? values.VERCEL_REGION : undefined;
    const outbound = createHash("sha256");
    for (const part of ["ccpun-line-outbound-worker-v1", "11111111-1111-4111-8111-111111111111", deploymentId?.trim() ?? "local"]) outbound.update(part).update("\0");
    assert.equal(result.outbound.value, outbound.digest("hex"));
    assert.equal(result.queries[1].payload.worker_digest, createHash("sha256").update(`${deploymentId ?? "local"}:${region ?? "unknown"}`).digest("hex"));
  }
});
