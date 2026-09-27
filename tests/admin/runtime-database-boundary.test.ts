import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");

test("runtime database modules keep purpose-specific credentials and no generic owner fallback", () => {
  const admin = read("lib/admin/operations/database.ts");
  const social = read("lib/admin/social/database.ts");
  const localAdmin = read("lib/admin/local-ai/database.ts");
  const line = read("apps/web/lib/line/private-ingestion.ts");
  const worker = read("workers/local-ai/src/index.ts");

  assert.match(admin, /process\.env\.CCPUN_ADMIN_DATABASE_URL/);
  assert.match(social, /process\.env\.CCPUN_SOCIAL_DATABASE_URL/);
  assert.match(localAdmin, /process\.env\.CCPUN_ADMIN_DATABASE_URL/);
  assert.match(line, /CCPUN_LINE_INGEST_DATABASE_URL/);
  assert.match(worker, /required\("CCPUN_LOCAL_AI_DATABASE_URL"\)/);
  assert.match(worker, /ccpun_local_ai_runtime/);

  for (const source of [admin, social, localAdmin, line, worker]) {
    assert.doesNotMatch(source, /process\.env\.(?:DATABASE_URL|POSTGRES_URL|NEON_DATABASE_URL|NEON_URL)/);
  }
});

test("runtime database clients verify lane or database identity before use", () => {
  const admin = read("lib/admin/operations/database.ts");
  const social = read("lib/admin/social/database.ts");
  const localAdmin = read("lib/admin/local-ai/database.ts");
  const line = read("apps/web/lib/line/private-ingestion.ts");
  const worker = read("workers/local-ai/src/index.ts");

  assert.match(admin, /ADMIN_DATABASE_IDENTITY_MISMATCH/);
  assert.match(admin, /row\.role_name === ADMIN_OPERATIONS_IDENTITY\.runtimeRole/);
  assert.match(social, /resolveSocialRuntime/);
  assert.match(localAdmin, /LOCAL_AI_DATABASE_IDENTITY_MISMATCH/);
  assert.match(localAdmin, /row\.role_name !== runtime\.localAiIdentity\.runtimeRole/);
  assert.match(line, /CCPUN_LINE_NEON_PROJECT_ID/);
  assert.match(line, /CCPUN_LINE_NEON_BRANCH_ID/);
  assert.match(worker, /CONFIG_DATABASE_IDENTITY_MISMATCH/);
  assert.match(worker, /CONFIG_DATABASE_URL_DENIED/);
});
