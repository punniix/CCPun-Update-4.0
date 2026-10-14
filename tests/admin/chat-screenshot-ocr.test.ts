import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { z } from "zod";
import { neon, neonConfig } from "@neondatabase/serverless";
import { createLineContentCrypto } from "../../lib/line/private-crypto";

const root = path.resolve(import.meta.dirname, "../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const sourceBody = (sql: string) => sql.split("-- checksum-source-begin\n", 2)[1]?.split("-- checksum-source-end", 1)[0] ?? "";

test("Chat OCR migration is UAT/Production parity and checksum locked", () => {
  const uat = read("db/migrations/20260924_chat_ocr_import_v1_uat.sql");
  const production = read("db/migrations/20260924_chat_ocr_import_v1_production.sql");
  const uatBody = sourceBody(uat);
  const productionBody = sourceBody(production);
  assert.equal(uatBody, productionBody);
  const checksum = createHash("sha256").update(uatBody).digest("hex");
  assert.equal(checksum, "e62e2ec9868ea5cb3f7350fb8ffa07f11ef4cf4cd9e101d6ddca57192509f9d7");
  assert.match(uat, new RegExp("sha256:" + checksum));
  assert.match(production, new RegExp("sha256:" + checksum));
});

test("Chat OCR archive extension stays encrypted and least privilege", () => {
  const sql = sourceBody(read("db/migrations/20260924_chat_ocr_import_v1_production.sql"));
  assert.match(sql, /manual_ocr/);
  assert.match(sql, /chat-ocr-import-content/);
  assert.match(sql, /admin_import_chat_ocr_archive_message/);
  assert.match(sql, /REVOKE ALL ON FUNCTION private_line\.admin_import_chat_ocr_archive_message/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION private_line\.admin_import_chat_ocr_archive_message\(jsonb\)[\s\S]*TO ccpun_admin_runtime/);
  assert.doesNotMatch(sql, /GRANT (SELECT|INSERT|UPDATE|DELETE)[^;]*line_conversation_archive TO ccpun_admin_runtime/i);
});

test("Screenshot OCR workflow is private, local-only and does not save execution payloads", () => {
  const workflow = JSON.parse(read("workers/local-ai/n8n/chat-screenshot-ocr.direct.json"));
  assert.equal(workflow.active, false);
  assert.equal(workflow.settings.saveDataSuccessExecution, "none");
  assert.equal(workflow.settings.saveDataErrorExecution, "none");
  assert.equal(workflow.settings.saveExecutionProgress, false);
  assert.equal(workflow.settings.saveManualExecutions, false);
  assert.equal(workflow.settings.timezone, "Asia/Bangkok");

  const joined = JSON.stringify(workflow);
  assert.match(joined, /CCPUN_OCR_BASE_URL/);
  assert.match(joined, /PP-OCRv5/);
  assert.match(joined, /qwen3:1\.7b/);
  assert.doesNotMatch(joined, /api\.openai\.com|anthropic|gemini|Sanity/i);
});

test("OCR sidecar is opt-in, bounded and memory-only for uploaded images", () => {
  const compose = read("workers/local-ai/docker-compose.yml");
  const app = read("workers/local-ai/ocr/app.py");
  assert.match(compose, /profiles: \["ocr"\]/);
  assert.match(compose, /mem_limit: 1200m/);
  assert.match(compose, /cpus: "1\.0"/);
  assert.match(compose, /\/tmp:size=64m/);
  assert.match(app, /NamedTemporaryFile\(dir="\/tmp"/);
  assert.match(app, /unlink\(missing_ok=True\)/);
  assert.match(app, /Semaphore\(1\)/);
  assert.doesNotMatch(app, /open\([^\n]*["']a["']|sqlite|postgres|s3|upload/i);
});

test("Owner OCR bridge forwards image to n8n and requires human-confirmed CRM import", () => {
  const upload = read("apps/admin/app/api/admin/line/inbox/[leadId]/screenshot-ocr/route.ts");
  const confirm = read("apps/admin/app/api/admin/line/inbox/[leadId]/screenshot-ocr/confirm/route.ts");
  const ui = read("features/admin/line/ChatScreenshotImport.tsx");
  const archive = read("lib/admin/line/conversation-archive.ts");

  assert.match(upload, /CCPUN_N8N_CHAT_OCR_WEBHOOK_URL/);
  assert.match(upload, /CCPUN_CHAT_OCR_ENABLED/);
  assert.match(upload, /identity\.role !== "owner"/);
  assert.match(confirm, /importChatOcrMessages/);
  assert.match(ui, /ยืนยันและบันทึก/);
  assert.match(ui, /\+07:00/);
  assert.match(archive, /crypto\.encrypt\(text, "chat-ocr-import-content"\)/);
  assert.doesNotMatch(upload + confirm + archive, /console\.(?:log|info|warn|error|debug)/);
});

type OcrImportInput = {
  leadId: string;
  requestId: string;
  messages: Array<{ direction: "inbound" | "outbound"; text: string; occurredAt: string }>;
};

function loadAtomicOcrFixture() {
  const variables = {
    CCPUN_ADMIN_DATABASE_URL: "postgresql://synthetic@localhost/synthetic",
    CCPUN_LINE_ENCRYPTION_KEY_V1: Buffer.alloc(32, 7).toString("base64"),
  };
  const state = {
    transactionCalls: 0,
    standaloneCalls: 0,
    encryptionCalls: 0,
    failedIndex: null as number | null,
    failedEncryptionIndex: null as number | null,
    malformedReply: false,
    committed: new Set<string>(),
    prepared: [] as Array<{ query: string; payload: Record<string, unknown> }>,
  };
  const sql = {
    query: () => {
      state.standaloneCalls++;
      throw new Error("unexpected standalone query");
    },
    transaction: async (builder: (transaction: {
      query: (query: string, parameters: string[]) => { query: string; payload: Record<string, unknown> };
    }) => Array<{ query: string; payload: Record<string, unknown> }>) => {
      state.transactionCalls++;
      const queries = builder({
        query: (query, parameters) => ({ query, payload: JSON.parse(parameters[0]!) }),
      });
      assert.equal(Array.isArray(queries), true);
      state.prepared = queries;
      const staged = new Set(state.committed);
      const replies: Array<Array<{ outcome: string }>> = [];
      for (let index = 0; index < queries.length; index++) {
        const { query, payload } = queries[index]!;
        assert.equal(query, "SELECT outcome FROM private_line.admin_import_chat_ocr_archive_message($1::jsonb)");
        assert.deepEqual(Object.keys(payload).sort(), [
          "content_auth_tag_b64", "content_ciphertext_b64", "content_key_version",
          "content_nonce_b64", "direction", "lead_id", "occurred_at", "source_digest",
        ]);
        assert.equal(JSON.stringify(payload).includes("PRIVATE_CANARY"), false);
        if (state.failedIndex === index) throw new Error("PRIVATE_CANARY_DATABASE_ERROR");
        const digest = String(payload.source_digest);
        if (staged.has(digest)) {
          // Existing RPC returns duplicate first, then an additional imported row.
          replies.push([{ outcome: "duplicate" }, { outcome: "imported" }]);
        } else {
          staged.add(digest);
          replies.push([{ outcome: "imported" }]);
        }
      }
      // This models all-or-nothing commit; it is not a live PostgreSQL rollback proof.
      state.committed = staged;
      return state.malformedReply ? [] : replies;
    },
  };
  const loaded = { exports: {} as {
    importChatOcrMessages: (input: OcrImportInput, variables: Record<string, string>) =>
      Promise<{ imported: number; duplicate: number; total: number }>;
  } };
  runInNewContext(ts.transpileModule(read("lib/admin/line/conversation-archive.ts"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    module: loaded,
    exports: loaded.exports,
    require: (name: string) => {
      if (name === "server-only") return {};
      if (name === "node:crypto") return { createHash };
      if (name === "zod") return { z };
      if (name === "@neondatabase/serverless") return { neon: () => sql };
      if (name === "../operations/foundation") return {
        adminOperationsRuntimeInputFromEnvironment: () => ({}),
        resolveAdminOperationsRuntimeIdentity: () => ({}),
      };
      if (name === "../../line/private-crypto") return {
        createLineContentCrypto: () => {
          const crypto = createLineContentCrypto(variables);
          return {
            ...crypto,
            encrypt: (text: string, purpose: string) => {
              const index = state.encryptionCalls++;
              if (index === state.failedEncryptionIndex) throw new Error("synthetic-encryption-failure");
              return crypto.encrypt(text, purpose);
            },
          };
        },
        isLinePrivateKeyVersion: (version: unknown) => version === 1 || version === 2,
      };
      throw new Error("unexpected fixture import");
    },
    Buffer, Date, AbortSignal, Error,
  });
  return { state, variables, importBatch: loaded.exports.importChatOcrMessages };
}

function ocrBatch(): OcrImportInput {
  return {
    leadId: "a1000000-0000-4000-8000-000000000001",
    requestId: "synthetic-request-0001",
    messages: [
      { direction: "inbound", text: " PRIVATE_CANARY_ONE ", occurredAt: "2026-10-14T10:00:00+07:00" },
      { direction: "outbound", text: "PRIVATE_CANARY_TWO", occurredAt: "2026-10-14T10:01:00+07:00" },
    ],
  };
}

test("OCR import prevalidates the complete batch before encryption or DB work", async () => {
  for (const bad of [
    { direction: "inbound", text: "", occurredAt: "2026-10-14T10:01:00+07:00" },
    { direction: "unknown", text: "PRIVATE_CANARY", occurredAt: "2026-10-14T10:01:00+07:00" },
    { direction: "inbound", text: "PRIVATE_CANARY", occurredAt: "not-a-date" },
    { direction: "inbound", text: 123, occurredAt: "2026-10-14T10:01:00+07:00" },
    { direction: "inbound", text: "x".repeat(5001), occurredAt: "2026-10-14T10:01:00+07:00" },
    null,
  ]) {
    const fixture = loadAtomicOcrFixture();
    const input = ocrBatch();
    input.messages[1] = bad as unknown as OcrImportInput["messages"][number];
    await assert.rejects(fixture.importBatch(input, fixture.variables), /CHAT_OCR_IMPORT_INVALID_MESSAGE/);
    assert.equal(fixture.state.encryptionCalls, 0);
    assert.equal(fixture.state.transactionCalls, 0);
    assert.equal(fixture.state.standaloneCalls, 0);
    assert.equal(fixture.state.committed.size, 0);
  }
  const fixture = loadAtomicOcrFixture();
  const oversized = ocrBatch();
  oversized.messages = Array.from({ length: 201 }, () => oversized.messages[0]!);
  await assert.rejects(fixture.importBatch(oversized, fixture.variables), /CHAT_OCR_IMPORT_INVALID_MESSAGES/);
  assert.equal(fixture.state.transactionCalls, 0);
});

test("OCR import encrypts all rows and submits one transaction preserving digest and duplicate semantics", async () => {
  const fixture = loadAtomicOcrFixture();
  const input = ocrBatch();
  const first = await fixture.importBatch(input, fixture.variables);
  assert.deepEqual(JSON.parse(JSON.stringify(first)), { imported: 2, duplicate: 0, total: 2 });
  assert.equal(fixture.state.transactionCalls, 1);
  assert.equal(fixture.state.standaloneCalls, 0);
  assert.equal(fixture.state.committed.size, 2);
  const crypto = createLineContentCrypto(fixture.variables);
  for (const [index, prepared] of fixture.state.prepared.entries()) {
    const message = input.messages[index]!;
    const payload = prepared.payload;
    assert.equal(crypto.decrypt({
      keyVersion: payload.content_key_version as 1,
      ciphertextB64: String(payload.content_ciphertext_b64),
      nonceB64: String(payload.content_nonce_b64),
      authTagB64: String(payload.content_auth_tag_b64),
    }, "chat-ocr-import-content"), message.text.trim());
    assert.equal(payload.source_digest, createHash("sha256").update([
      "ccpun-chat-ocr-v1", input.leadId, input.requestId, String(index),
      message.direction, new Date(message.occurredAt).toISOString(), message.text.trim(),
    ].join("\0")).digest("hex"));
  }
  const repeated = await fixture.importBatch(input, fixture.variables);
  assert.deepEqual(JSON.parse(JSON.stringify(repeated)), { imported: 0, duplicate: 2, total: 2 });
  assert.equal(fixture.state.transactionCalls, 2);
  assert.equal(fixture.state.committed.size, 2);
});

test("OCR import models rollback when second RPC fails and normalizes driver errors", async () => {
  const fixture = loadAtomicOcrFixture();
  fixture.state.failedIndex = 1;
  await assert.rejects(fixture.importBatch(ocrBatch(), fixture.variables), (error: unknown) =>
    error instanceof Error && error.message === "CHAT_OCR_IMPORT_FAILED");
  assert.equal(fixture.state.transactionCalls, 1);
  assert.equal(fixture.state.prepared.length, 2);
  assert.equal(fixture.state.committed.size, 0);
  assert.equal(fixture.state.standaloneCalls, 0);
});

test("OCR import prepares no DB transaction after encryption failure and does not claim malformed replies succeeded", async () => {
  const encryption = loadAtomicOcrFixture();
  encryption.state.failedEncryptionIndex = 1;
  await assert.rejects(encryption.importBatch(ocrBatch(), encryption.variables), /synthetic-encryption-failure/);
  assert.equal(encryption.state.transactionCalls, 0);
  assert.equal(encryption.state.committed.size, 0);

  const uncertain = loadAtomicOcrFixture();
  uncertain.state.malformedReply = true;
  await assert.rejects(uncertain.importBatch(ocrBatch(), uncertain.variables), /CHAT_OCR_IMPORT_FAILED/);
  // A malformed response is unconfirmed; do not infer that the server did not commit.
  assert.equal(uncertain.state.transactionCalls, 1);
  assert.equal(uncertain.state.committed.size, 2);
});

test("installed Neon transaction builder batches queries in one mocked HTTP call", async () => {
  const originalFetch = neonConfig.fetchFunction;
  let calls = 0;
  let fail = false;
  neonConfig.fetchFunction = async (_url: RequestInfo | URL, options?: RequestInit) => {
    calls++;
    const body = JSON.parse(String(options?.body)) as { queries: Array<{ query: string }> };
    assert.equal(body.queries.length, 2);
    if (fail) return new Response(JSON.stringify({
      message: "SIMULATED_RPC_FAILURE", code: "XX000",
    }), { status: 400, headers: { "Content-Type": "application/json" } });
    return new Response(JSON.stringify({
      results: body.queries.map(() => ({
        fields: [{ name: "outcome", dataTypeID: 25 }],
        rows: [["imported"]], rowCount: 1, command: "SELECT",
      })),
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const sql = neon("postgresql://synthetic@localhost/synthetic");
    const batch = () => sql.transaction((transaction) => [
      transaction.query("SELECT outcome FROM synthetic_rpc($1::jsonb)", ["{}"]),
      transaction.query("SELECT outcome FROM synthetic_rpc($1::jsonb)", ["{}"]),
    ]);
    const result = await batch();
    assert.equal(calls, 1);
    assert.equal(result[0]?.[0]?.outcome, "imported");
    assert.equal(result[1]?.[0]?.outcome, "imported");
    fail = true;
    await assert.rejects(batch(), /SIMULATED_RPC_FAILURE/);
    assert.equal(calls, 2);
  } finally {
    neonConfig.fetchFunction = originalFetch;
  }
});
