import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");
const ready = Object.fromEntries(["runtime_current", "isolation_current", "ledger_current", "column_current", "trigger_current", "other_triggers_absent", "rls_absent", "immediate_fk_current", "receipt_grant_current", "audit_append_only"].map((key) => [key, true]));
const mutation = { publicationId: "publication-1", expectedJobVersion: 1, idempotencyKey: "request-key-00001", scheduledAt: "2030-01-01T00:00:00.000Z" };
const actor = "owner@example.test";
function receipt(action: "reschedule" | "cancel", payload = mutation, who = actor) {
  const actorRef = "admin:" + createHash("sha256").update(who).digest("hex").slice(0, 32);
  return { schemaVersion: 1, action, publicationId: payload.publicationId, idempotencyKey: payload.idempotencyKey,
    actorRef, payloadDigest: createHash("sha256").update(JSON.stringify([action, actorRef, payload])).digest("hex"), payload,
    result: action === "reschedule"
      ? { state: "rescheduled", publicationId: payload.publicationId, jobId: "original-job", jobVersion: payload.expectedJobVersion + 1, scheduledAt: payload.scheduledAt }
      : { state: "cancelled", publicationId: payload.publicationId, jobId: "original-job", jobVersion: payload.expectedJobVersion + 1 } };
}
async function service(query: (sql: string, params: unknown[]) => Promise<unknown>) {
  const ts = await import("typescript"); const { z } = await import("zod"); const crypto = await import("node:crypto");
  const source = read("lib/admin/social/operations-service.ts");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports: Record<string, unknown> = {};
  new Function("require", "exports", compiled)((id: string) => {
    if (id === "server-only") return {};
    if (id === "node:crypto") return crypto;
    if (id === "zod") return { z };
    if (id === "@neondatabase/serverless") return { neon: () => ({ query }) };
    if (id === "./database") return { getSocialDatabaseReadiness: async () => ({ reachable: true, migrationCurrent: true }) };
    if (id === "./publishing-store") return { listApprovedSocialVariants: async () => [] };
    throw new Error("Unexpected dependency " + id);
  }, exports);
  return exports as { rescheduleSocialPublication: (input: { mutation: unknown; actor: string; env: Record<string, string>; now?: Date }) => Promise<Record<string, unknown>>;
    cancelSocialPublication: (input: { mutation: unknown; actor: string; env: Record<string, string> }) => Promise<Record<string, unknown>>;
    SOCIAL_OPERATION_RECEIPT_READINESS_SQL: string; SOCIAL_OPERATION_RECEIPT_VERSION: string; SOCIAL_OPERATION_RECEIPT_CHECKSUM: string; SOCIAL_OPERATION_RECEIPT_TRIGGER_MD5: string };
}
const env = { CCPUN_SOCIAL_DATABASE_URL: "synthetic" };

test("receipt migration checksum and actual invoker body hash match amendment readiness pins", async () => {
  const api = await service(async () => []);
  const migration = read("db/migrations/20261004_social_operation_receipts_v1.sql");
  const checksumBody = migration.split("-- checksum-source-begin\n")[1]?.split("-- checksum-source-end")[0];
  assert.ok(checksumBody);
  assert.equal(api.SOCIAL_OPERATION_RECEIPT_CHECKSUM, "sha256:" + createHash("sha256").update(checksumBody).digest("hex"));
  const body = migration.split("AS $receipt_guard$")[1]?.split("$receipt_guard$;")[0]; assert.ok(body);
  assert.equal(api.SOCIAL_OPERATION_RECEIPT_TRIGGER_MD5, createHash("md5").update(body).digest("hex"));
  assert.match(migration, /VOLATILE SECURITY INVOKER/); assert.match(migration, /transaction_isolation/);
  assert.match(migration, /FOR UPDATE;[\s\S]*?SELECT id INTO latest_job/);
  assert.match(migration, /count_new>128/); assert.match(migration, /SOCIAL_RECEIPT_IMMUTABLE/);
  assert.match(migration, /GRANT UPDATE \(mutation_receipts\)/);
  assert.doesNotMatch(migration, /CREATE TABLE|SECURITY DEFINER|GRANT SELECT/);
  // PL/pgSQL reads IF up to the first THEN at depth zero: SQL CASE must be grouped.
  assert.doesNotMatch(body, /IS DISTINCT FROM CASE WHEN/);
  assert.equal(body.match(/IS DISTINCT FROM \(CASE WHEN/g)?.length, 4);
  const readback = read("db/migrations/20261004_social_operation_receipts_v1_readback.sql");
  const bound = api.SOCIAL_OPERATION_RECEIPT_READINESS_SQL.replace("$1", "'" + api.SOCIAL_OPERATION_RECEIPT_VERSION + "'")
    .replace("$2", "'" + api.SOCIAL_OPERATION_RECEIPT_CHECKSUM + "'").replace("$3", "'" + api.SOCIAL_OPERATION_RECEIPT_TRIGGER_MD5 + "'");
  assert.ok(readback.includes(bound));
  for (const statement of [api.SOCIAL_OPERATION_RECEIPT_READINESS_SQL, readback]) {
    assert.ok(statement.includes("NOT has_any_column_privilege(current_user,'ccpun_social.social_execution_audit','UPDATE,REFERENCES')"));
  }
  assert.ok(migration.includes("OR has_any_column_privilege('ccpun_social_runtime','ccpun_social.social_execution_audit','UPDATE,REFERENCES')"));

});

test("service replay returns original result before future-time or latest-state validation", async () => {
  const calls: string[] = [];
  const original = receipt("reschedule");
  const api = await service(async (sql) => { calls.push(sql); return sql.startsWith("SELECT\n  current_user") ? [ready] : [{ receipt: original }]; });
  const result = await api.rescheduleSocialPublication({ mutation, actor, env, now: new Date("2040-01-01") });
  assert.deepEqual(result, { ...original.result, state: "replay" });
  assert.equal(calls.length, 2); assert.match(calls[1], /publication_id=\$1 AND mutation_receipts/);
  assert.doesNotMatch(calls[1], /ORDER BY|social_execution_audit/);
});

test("service refuses changed actor, publication, key, version or schedule binding without mutation", async () => {
  for (const change of [{ actor: "other@example.test" }, { mutation: { ...mutation, publicationId: "other-publication" } },
    { mutation: { ...mutation, idempotencyKey: "other-request-00001" } }, { mutation: { ...mutation, expectedJobVersion: 2 } },
    { mutation: { ...mutation, scheduledAt: "2030-01-02T00:00:00.000Z" } }]) {
    let writes = 0;
    const api = await service(async (sql) => {
      if (sql.startsWith("SELECT\n  current_user")) return [ready];
      if (sql.startsWith("WITH")) writes++;
      return [{ receipt: receipt("reschedule") }];
    });
    await assert.rejects(api.rescheduleSocialPublication({ mutation, actor, env, ...change }), /SOCIAL_OPERATION_CAS_CONFLICT/);
    assert.equal(writes, 0);
  }
});

test("readiness rejects each unsafe catalog, role or isolation condition before receipt lookup/write", async () => {
  for (const key of Object.keys(ready)) {
    let calls = 0;
    const api = await service(async () => { calls++; return [{ ...ready, [key]: false }]; });
    await assert.rejects(api.rescheduleSocialPublication({ mutation, actor, env }), /SOCIAL_OPERATION_RECEIPTS_NOT_READY/);
    assert.equal(calls, 1);
  }
});

test("definite audit collision or zero CAS allows one readonly receipt lookup, never mutation retry", async () => {
  for (const failure of ["23505", "zero"]) {
    let writes = 0; let reads = 0;
    const saved = receipt("reschedule");
    const api = await service(async (sql) => {
      if (sql.startsWith("SELECT\n  current_user")) return [ready];
      if (sql.startsWith("WITH")) { writes++; if (failure === "23505") throw { code: "23505" }; return []; }
      reads++; return reads === 1 ? [] : [{ receipt: saved }];
    });
    assert.deepEqual(await api.rescheduleSocialPublication({ mutation, actor, env, now: new Date("2026-01-01") }), { ...saved.result, state: "replay" });
    assert.equal(writes, 1); assert.equal(reads, 2);
  }
});

test("legacy audit key without receipt holds; uncertain transport never retries or reads a guessed result", async () => {
  for (const code of ["23505", "08006"]) {
    let writes = 0; let reads = 0;
    const api = await service(async (sql) => {
      if (sql.startsWith("SELECT\n  current_user")) return [ready];
      if (sql.startsWith("WITH")) { writes++; throw { code, message: "SYNTHETIC_RAW_ERROR_NOT_FOR_OUTPUT" }; }
      reads++; return [];
    });
    await assert.rejects(api.rescheduleSocialPublication({ mutation, actor, env, now: new Date("2026-01-01") }),
      code === "23505" ? /^Error: SOCIAL_OPERATION_LEGACY_REPLAY_HOLD$/ : /^Error: SOCIAL_OPERATION_OUTCOME_UNKNOWN$/);
    assert.equal(writes, 1); assert.equal(reads, code === "23505" ? 2 : 1);
  }
});

test("cancel uses exact action-bound payload and original durable result", async () => {
  const payload = { publicationId: mutation.publicationId, expectedJobVersion: 1, idempotencyKey: mutation.idempotencyKey };
  const saved = receipt("cancel", payload as typeof mutation);
  const api = await service(async (sql) => sql.startsWith("SELECT\n  current_user") ? [ready] : [{ receipt: saved }]);
  assert.deepEqual(await api.cancelSocialPublication({ mutation: payload, actor, env }), { ...saved.result, state: "replay" });
});


test("first amendments bind one full receipt and audit statement and return its original result", async () => {
  for (const action of ["reschedule", "cancel"] as const) {
    const payload = action === "reschedule" ? mutation : { publicationId: mutation.publicationId, expectedJobVersion: 1, idempotencyKey: mutation.idempotencyKey };
    const expected = receipt(action, payload as typeof mutation);
    const calls: { sql: string; params: unknown[] }[] = [];
    const api = await service(async (sql, params) => {
      calls.push({ sql, params });
      if (sql.startsWith("SELECT\n  current_user")) return [ready];
      return sql.startsWith("WITH") ? [{ result: expected.result }] : [];
    });
    const input = { mutation: payload, actor, env, now: new Date("2026-01-01") };
    const result = action === "reschedule" ? await api.rescheduleSocialPublication(input) : await api.cancelSocialPublication(input);
    assert.deepEqual(result, expected.result); assert.equal(calls.length, 3);
    assert.deepEqual(calls[2].params, [payload.publicationId, 1, action, action === "reschedule" ? mutation.scheduledAt : null,
      expected.actorRef, payload.idempotencyKey, expected.payloadDigest, "audit:" + payload.idempotencyKey + ":" + action, JSON.stringify(payload)]);
    assert.match(calls[2].sql, /FROM amended_job RETURNING 1/); assert.doesNotMatch(calls[2].sql, /ON CONFLICT/);
  }
});

test("a missing receipt with an elapsed schedule is denied before mutation", async () => {
  let writes = 0;
  const api = await service(async (sql) => { if (sql.startsWith("SELECT\n  current_user")) return [ready]; if (sql.startsWith("WITH")) writes++; return []; });
  await assert.rejects(api.rescheduleSocialPublication({ mutation, actor, env, now: new Date("2040-01-01") }), /SOCIAL_RESCHEDULE_REQUIRES_FUTURE_TIME/);
  assert.equal(writes, 0);
});
