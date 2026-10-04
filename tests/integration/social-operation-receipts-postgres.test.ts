import assert from "node:assert/strict";
import { execFile, execFileSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { promisify } from "node:util";

// Opt-in only: a separately approved disposable PostgreSQL 18 fixture. Never Neon.
const enabled = process.env.CCPUN_SOCIAL_RECEIPT_DISPOSABLE_PG === "1";
const args = ["-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=sqlstate"];
const read = (path: string) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");
const literal = (value: unknown) => value === null ? "NULL" : typeof value === "number" ? String(value) : "'" + String(value).replaceAll("'", "''") + "'";
const ownerSql = (statement: string) => execFileSync("psql", args, { input: statement, encoding: "utf8", timeout: 15_000, stdio: ["pipe", "pipe", "pipe"] }).trim();
async function runtimeQuery(statement: string, params: unknown[]) {
  const bound = statement.replace(/\$(\d+)/g, (_match, index) => literal(params[Number(index) - 1]));
  // Keep modifying CTEs at top level; wrap only the final SELECT for psql JSON transport.
  const finalMarker = bound.lastIndexOf("\nSELECT amended_job.result");
  if (bound.startsWith("WITH")) assert.ok(finalMarker >= 0, "fixture must preserve actual final result SELECT");
  const final = bound.startsWith("WITH") ? finalMarker + 1 : 0;
  const json = bound.slice(0, final) + "SELECT COALESCE(json_agg(fixture_rows),'[]'::json) FROM (" + bound.slice(final) + ") AS fixture_rows";
  return await new Promise<unknown>((resolve, reject) => {
    const child = spawn("psql", args, { env: { ...process.env, PGAPPNAME: "social-receipt-fixture-call" }, stdio: ["pipe", "pipe", "pipe"] });
    let output = ""; let error = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), 15_000);
    child.stdout.on("data", (chunk) => { output += chunk; if (output.length > 1_048_576) child.kill("SIGKILL"); });
    child.stderr.on("data", (chunk) => { error += chunk; if (error.length > 65_536) child.kill("SIGKILL"); });
    child.on("error", (failure) => { clearTimeout(timer); reject(failure); });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject({ code: /\b(23505|23514|40001|40P01|42501)\b/.exec(error)?.[1] ?? "FIXTURE_QUERY_ERROR" });
      try { resolve(JSON.parse(output.trim())); } catch { reject(new Error("FIXTURE_RESULT_INVALID")); }
    });
    child.stdin.on("error", () => child.kill("SIGKILL"));
    child.stdin.end("SET ROLE ccpun_social_runtime; " + json + ";");
  });
}

async function loadService(query = runtimeQuery) {
  const ts = await import("typescript"); const { z } = await import("zod"); const crypto = await import("node:crypto");
  const exports: Record<string, unknown> = {};
  const compiled = ts.transpileModule(read("lib/admin/social/operations-service.ts"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function("require", "exports", compiled)((id: string) => {
    if (id === "server-only") return {};
    if (id === "node:crypto") return crypto;
    if (id === "zod") return { z };
    if (id === "@neondatabase/serverless") return { neon: () => ({ query }) };
    // The real fixture exercises actual SQL, roles, migration and trigger. It is not an external data-lane probe.
    if (id === "./database") return { getSocialDatabaseReadiness: async () => ({ reachable: true, migrationCurrent: true }) };
    if (id === "./publishing-store") return { listApprovedSocialVariants: async () => [] };
    throw new Error("Unexpected fixture dependency");
  }, exports);
  return exports as {
    rescheduleSocialPublication: (input: { mutation: { publicationId: string; expectedJobVersion: number; idempotencyKey: string; scheduledAt: string }; actor: string; env: Record<string, string>; now?: Date }) => Promise<Record<string, unknown>>;
    cancelSocialPublication: (input: { mutation: { publicationId: string; expectedJobVersion: number; idempotencyKey: string }; actor: string; env: Record<string, string> }) => Promise<Record<string, unknown>>;
  };
}
function seed(id: string) {
  ownerSql(`INSERT INTO ccpun_social.social_variant_link VALUES (${literal(id)},'facebook');
    INSERT INTO ccpun_social.social_publication(id,variant_id,status,execution_target,scheduled_at)
      VALUES (${literal(id)},${literal(id)},'approved','facebook-native-scheduled','2029-01-01');
    INSERT INTO ccpun_social.social_publication_job(id,publication_id,status,version,attempt_count,created_at)
      VALUES (${literal(id + '-job')},${literal(id)},'queued',1,0,'2026-01-01');`);
}
const snapshot = (id: string) => ownerSql(`SELECT json_build_object('publication',row_to_json(p),'jobs',
  (SELECT json_agg(j ORDER BY id) FROM ccpun_social.social_publication_job j WHERE publication_id=p.id),
  'auditCount',(SELECT count(*) FROM ccpun_social.social_execution_audit WHERE object_id=p.id))
  FROM ccpun_social.social_publication p WHERE id=${literal(id)};`);
async function waitForLock(app: string) {
  for (let i = 0; i < 100; i++) {
    if (ownerSql(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name=${literal(app)} AND wait_event_type='Lock');`) === "t") return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("FIXTURE_LOCK_NOT_OBSERVED");
}
async function heldPublication(id: string, createNewJob: boolean) {
  const child = spawn("psql", args, { stdio: ["pipe", "pipe", "pipe"] });
  let out = ""; let errors = ""; let heldTimer: ReturnType<typeof setTimeout>;
  // Bound this fixture holder even if a later assertion fails before commit.
  const lifetime = setTimeout(() => child.kill("SIGKILL"), 20_000);
  const held = new Promise<void>((resolve, reject) => {
    heldTimer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("FIXTURE_HOLDER_TIMEOUT")); }, 10_000);
    child.stdout.on("data", (chunk) => { out += chunk; if (out.includes("FIXTURE_HELD")) { clearTimeout(heldTimer); resolve(); } });
    child.stderr.on("data", (chunk) => { errors += chunk; });
    child.on("error", () => { clearTimeout(heldTimer); reject(new Error("FIXTURE_HOLDER_FAILED")); });
    child.on("close", () => { clearTimeout(heldTimer); if (!out.includes("FIXTURE_HELD")) reject(new Error("FIXTURE_HOLDER_FAILED")); });
  });
  const closed = new Promise<number | null>((resolve) => child.on("close", (code) => { clearTimeout(lifetime); resolve(code); }));
  child.stdin.on("error", () => child.kill("SIGKILL"));
  child.stdin.write(`BEGIN; SELECT id FROM ccpun_social.social_publication WHERE id=${literal(id)} FOR UPDATE;
    ${createNewJob ? `INSERT INTO ccpun_social.social_publication_job(id,publication_id,status,version,attempt_count,created_at) VALUES (${literal(id + '-new')},${literal(id)},'queued',1,0,'2027-01-01');` : ""}
    SELECT 'FIXTURE_HELD';\n`);
  await held;
  return { async commit() { child.stdin.end("COMMIT;\n"); assert.equal(await closed, 0, "fixture holder must commit"); assert.equal(errors, ""); } };
}

test("real PostgreSQL: receipts, INSERT-only audit, concurrency and whole-statement rollback", { skip: !enabled, timeout: 120_000 }, async () => {
  assert.equal(process.env.PGHOST, "127.0.0.1"); assert.equal(process.env.PGDATABASE, "neondb");
  assert.ok(Number(ownerSql("SHOW server_version_num")) >= 180000);
  assert.equal(ownerSql("SELECT to_regnamespace('ccpun_social') IS NULL"), "t", "fixture must be fresh, no cleanup of existing data");
  ownerSql(`CREATE ROLE ccpun_social_runtime NOLOGIN;
    CREATE SCHEMA ccpun_social;
    CREATE TABLE ccpun_social.system_identity(singleton boolean,project_id text,branch_id text,endpoint_id text,database_name text);
    INSERT INTO ccpun_social.system_identity VALUES(true,'young-term-47483330','br-crimson-mouse-az7ajkv8','ep-mute-frost-aztvz394','neondb');
    CREATE TABLE ccpun_social.schema_migration(version text PRIMARY KEY,checksum text);
    INSERT INTO ccpun_social.schema_migration VALUES('20260901_website_42_social_publication_execution_v1','sha256:9c9a95c3f29d0c912b6b0c226fea873569809f49ebc8f1a66ab32699bde85bba');
    CREATE TABLE ccpun_social.social_variant_link(variant_id text PRIMARY KEY,channel text);
    CREATE TABLE ccpun_social.social_publication(id text PRIMARY KEY,variant_id text REFERENCES ccpun_social.social_variant_link,
      status text,execution_target text,scheduled_at timestamptz,platform_object_id text,published_at timestamptz,updated_at timestamptz DEFAULT now());
    CREATE TABLE ccpun_social.social_publication_job(id text PRIMARY KEY,publication_id text REFERENCES ccpun_social.social_publication(id),
      status text,version integer,attempt_count integer,lock_owner text,locked_at timestamptz,lock_expires_at timestamptz,
      last_error_category text,last_error_ref text,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
    CREATE TABLE ccpun_social.social_execution_audit(id text PRIMARY KEY,actor_type text,actor_ref text,action text,object_type text,object_id text,request_ref text,outcome text);
    GRANT USAGE ON SCHEMA ccpun_social TO ccpun_social_runtime;
    GRANT SELECT ON ccpun_social.system_identity,ccpun_social.schema_migration,ccpun_social.social_variant_link,
      ccpun_social.social_publication,ccpun_social.social_publication_job TO ccpun_social_runtime;
    GRANT INSERT ON ccpun_social.social_publication_job,ccpun_social.social_execution_audit TO ccpun_social_runtime;
    GRANT UPDATE(status,scheduled_at,platform_object_id,published_at,updated_at) ON ccpun_social.social_publication TO ccpun_social_runtime;
    GRANT UPDATE(status,version,attempt_count,lock_owner,locked_at,lock_expires_at,last_error_category,last_error_ref,updated_at)
      ON ccpun_social.social_publication_job TO ccpun_social_runtime;`);
  const migration = read("db/migrations/20261004_social_operation_receipts_v1.sql"); ownerSql(migration); ownerSql(migration);
  const api = await loadService(); const actor = "owner@example.test"; const env = { CCPUN_SOCIAL_DATABASE_URL: "synthetic-fixture" };
  const request = (id: string, key: string, version = 1) => ({ publicationId: id, expectedJobVersion: version, idempotencyKey: key, scheduledAt: "2030-01-01T00:00:00.000Z" });

  seed("replay"); const original = await api.rescheduleSocialPublication({ mutation: request("replay", "replay-request-01"), actor, env });
  assert.equal(original.jobVersion, 2);
  await api.cancelSocialPublication({ mutation: { publicationId: "replay", expectedJobVersion: 2, idempotencyKey: "cancel-request-01" }, actor, env });
  ownerSql("INSERT INTO ccpun_social.social_publication_job(id,publication_id,status,version,attempt_count,created_at) VALUES('replay-new','replay','queued',1,0,'2027-01-01')");
  assert.deepEqual(await api.rescheduleSocialPublication({ mutation: request("replay", "replay-request-01"), actor, env, now: new Date("2040-01-01") }), { ...original, state: "replay" });
  await assert.rejects(api.rescheduleSocialPublication({ mutation: request("replay", "replay-request-01"), actor: "other@example.test", env }), /CAS_CONFLICT/);
  await assert.rejects(api.rescheduleSocialPublication({ mutation: { ...request("replay", "replay-request-01"), scheduledAt: "2030-01-02T00:00:00.000Z" }, actor, env }), /CAS_CONFLICT/);

  seed("collision"); ownerSql("INSERT INTO ccpun_social.social_execution_audit(id,object_id) VALUES('audit:collision-key-01:reschedule','collision')");
  const collisionBefore = snapshot("collision");
  await assert.rejects(api.rescheduleSocialPublication({ mutation: request("collision", "collision-key-01"), actor, env }), /LEGACY_REPLAY_HOLD/);
  assert.equal(snapshot("collision"), collisionBefore, "audit 23505 must roll back publication, job and appended receipt");
  seed("wrong-publication"); const wrongBefore = snapshot("wrong-publication");
  await assert.rejects(api.rescheduleSocialPublication({ mutation: request("wrong-publication", "replay-request-01"), actor, env }), /LEGACY_REPLAY_HOLD/);
  assert.equal(snapshot("wrong-publication"), wrongBefore);
  seed("zero-cas"); const casBefore = snapshot("zero-cas");
  await assert.rejects(api.rescheduleSocialPublication({ mutation: request("zero-cas", "cas-request-0001", 99), actor, env }), /CAS_CONFLICT/);
  assert.equal(snapshot("zero-cas"), casBefore);

  seed("parallel"); let reached = 0; let release!: () => void; const gate = new Promise<void>((resolve) => { release = resolve; });
  const parallelApi = await loadService(async (sql, values) => { if (sql.startsWith("WITH")) { reached++; if (reached === 2) release(); await gate; } return runtimeQuery(sql, values); });
  const same = await Promise.all([1, 2].map(() => parallelApi.rescheduleSocialPublication({ mutation: request("parallel", "parallel-key-001"), actor, env })));
  assert.deepEqual(new Set(same.map((row) => row.state)), new Set(["rescheduled", "replay"]));
  assert.equal(ownerSql("SELECT count(*) FROM ccpun_social.social_execution_audit WHERE object_id='parallel'"), "1");

  seed("parallel-different"); reached = 0;
  let releaseDifferent!: () => void; const differentGate = new Promise<void>((resolve) => { releaseDifferent = resolve; });
  const differentApi = await loadService(async (sql, values) => { if (sql.startsWith("WITH")) { reached++; if (reached === 2) releaseDifferent(); await differentGate; } return runtimeQuery(sql, values); });
  const different = await Promise.allSettled(["different-key-01", "different-key-02"].map((key) => differentApi.rescheduleSocialPublication({ mutation: request("parallel-different", key), actor, env })));
  assert.equal(different.filter((row) => row.status === "fulfilled").length, 1);
  assert.equal(different.filter((row) => row.status === "rejected").length, 1);
  assert.equal(ownerSql("SELECT count(*) FROM ccpun_social.social_execution_audit WHERE object_id='parallel-different'"), "1");

  seed("stale"); const hold = await heldPublication("stale", true);
  const staleCall = api.rescheduleSocialPublication({ mutation: request("stale", "stale-request-01"), actor, env });
  await waitForLock("social-receipt-fixture-call"); await hold.commit(); const staleBefore = snapshot("stale");
  await assert.rejects(staleCall, /OUTCOME_UNKNOWN/);
  assert.equal(snapshot("stale"), staleBefore, "fresh trigger snapshot rejects stale job atomically");
  const fresh = await api.rescheduleSocialPublication({ mutation: request("stale", "fresh-request-01"), actor, env }); assert.equal(fresh.jobId, "stale-new");

  seed("fk-fence"); const fence = await heldPublication("fk-fence", false);
  const insert = promisify(execFile)("psql", [...args, "-c", "INSERT INTO ccpun_social.social_publication_job(id,publication_id,status,version,attempt_count) VALUES('fk-fence-new','fk-fence','queued',1,0)"], { env: { ...process.env, PGAPPNAME: "social-receipt-fixture-insert" }, timeout: 15_000 });
  await waitForLock("social-receipt-fixture-insert"); await fence.commit(); await insert;

  seed("column-privileges"); const privilegeBefore = snapshot("column-privileges");
  for (const privilege of ["UPDATE(actor_ref)", "REFERENCES(id)"]) {
    ownerSql("GRANT " + privilege + " ON ccpun_social.social_execution_audit TO ccpun_social_runtime");
    await assert.rejects(api.cancelSocialPublication({ mutation: { publicationId: "column-privileges", expectedJobVersion: 1,
      idempotencyKey: "column-privilege-01" }, actor, env }), /RECEIPTS_NOT_READY/);
    assert.equal(snapshot("column-privileges"), privilegeBefore, "column-level privilege drift denies before mutation");
    assert.throws(() => ownerSql(migration), "migration guard must also reject column-level unsafe grants");
    ownerSql("REVOKE " + privilege + " ON ccpun_social.social_execution_audit FROM ccpun_social_runtime");
  }

  seed("capacity");
  for (let version = 1; version <= 128; version++) {
    await api.cancelSocialPublication({ mutation: { publicationId: "capacity", expectedJobVersion: version,
      idempotencyKey: "capacity-key-" + String(version).padStart(4, "0") }, actor, env });
  }
  const capacityBefore = snapshot("capacity");
  await assert.rejects(api.cancelSocialPublication({ mutation: { publicationId: "capacity", expectedJobVersion: 129,
    idempotencyKey: "capacity-key-0129" }, actor, env }), /OUTCOME_UNKNOWN/);
  assert.equal(snapshot("capacity"), capacityBefore, "capacity must roll back without evicting original receipts");
  const oldest = await api.cancelSocialPublication({ mutation: { publicationId: "capacity", expectedJobVersion: 1,
    idempotencyKey: "capacity-key-0001" }, actor, env });
  assert.equal(oldest.state, "replay"); assert.equal(oldest.jobVersion, 2);

  for (const statement of [
    "SELECT id FROM ccpun_social.social_execution_audit",
    "UPDATE ccpun_social.social_publication_job SET mutation_receipts='{}' WHERE id='replay-job'",
    "UPDATE ccpun_social.social_publication_job SET mutation_receipts=mutation_receipts || jsonb_build_object('oversized',repeat('x',65537)) WHERE id='replay-job'",
    "INSERT INTO ccpun_social.social_publication_job(id,publication_id,mutation_receipts) VALUES('forged','replay','{\"forged\":true}')",
  ]) assert.throws(() => ownerSql("SET ROLE ccpun_social_runtime; " + statement));
  assert.throws(() => ownerSql("DELETE FROM ccpun_social.social_publication_job WHERE id='replay-job'"), "receipts remain immutable even for fixture owner");
  ownerSql("SET ROLE ccpun_social_runtime; UPDATE ccpun_social.social_publication_job SET updated_at=now() WHERE id='replay-job'");
  assert.throws(() => ownerSql("BEGIN ISOLATION LEVEL REPEATABLE READ; SET ROLE ccpun_social_runtime; UPDATE ccpun_social.social_publication_job SET mutation_receipts=mutation_receipts || '{\"new\":{}}' WHERE id='replay-job'; COMMIT"));
});
