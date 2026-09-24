import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

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
