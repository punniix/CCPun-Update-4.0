import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
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


test("real OCR handler rejects oversized streams and busy jobs before buffering, and releases every exit", () => {
  // Execute the actual handler with stdlib-only framework/image/engine doubles.
  // This does not install or start the private worker or exercise its model.
  const result = spawnSync("python3", ["-c", String.raw`
import asyncio, hashlib, json, pathlib, subprocess, sys, types
class HTTPException(Exception):
    def __init__(self, status_code, detail): self.status_code, self.detail = status_code, detail
class FastAPI:
    def __init__(self, **kwargs): pass
    def get(self, path): return lambda fn: fn
    def post(self, path): return lambda fn: fn
class JSONResponse:
    def __init__(self, content): self.content = content
fastapi = types.ModuleType("fastapi")
fastapi.FastAPI, fastapi.HTTPException, fastapi.Request = FastAPI, HTTPException, object
responses = types.ModuleType("fastapi.responses"); responses.JSONResponse = JSONResponse
sys.modules["fastapi"], sys.modules["fastapi.responses"] = fastapi, responses
class InvalidImage(Exception): pass
class FakeImage:
    def __enter__(self): return self
    def __exit__(self, *args): pass
    def convert(self, mode): return self
    def thumbnail(self, *args): pass
    def save(self, path, **kwargs): pathlib.Path(path).write_bytes(b"synthetic-image")
image = types.SimpleNamespace(MAX_IMAGE_PIXELS=0, Resampling=types.SimpleNamespace(LANCZOS=1),
    DecompressionBombError=InvalidImage, open=lambda body: FakeImage())
pil = types.ModuleType("PIL"); pil.Image, pil.ImageOps, pil.UnidentifiedImageError = image, types.SimpleNamespace(exif_transpose=lambda value: value), InvalidImage
sys.modules["PIL"] = pil
ns = {}; exec(compile(pathlib.Path(sys.argv[1]).read_text(), sys.argv[1], "exec"), ns)
ns["TOKEN"] = "synthetic-" + "x" * 50
ns["MAX_BYTES"] = 8 * 1024 * 1024
engine_paths, temp_paths = [], []
original_temp = ns["tempfile"].NamedTemporaryFile
def tracked_temp(*args, **kwargs):
    result = original_temp(*args, **kwargs); temp_paths.append(pathlib.Path(result.name)); return result
ns["tempfile"].NamedTemporaryFile = tracked_temp
def engine(*args, **kwargs):
    engine_paths.append(pathlib.Path(args[0][-1])); assert engine_paths[-1].exists()
    return types.SimpleNamespace(returncode=0, stdout=json.dumps({"lines": [], "reviewRequired": True}))
ns["subprocess"].run = engine
class Request:
    def __init__(self, chunks, auth=True, mime="image/png", length=None):
        self.headers = {"authorization": "Bearer " + ns["TOKEN"] if auth else "invalid", "content-type": mime}
        if length is not None: self.headers["content-length"] = length
        self.chunks, self.reads = chunks, 0
    async def stream(self):
        for chunk in self.chunks:
            self.reads += 1
            if isinstance(chunk, Exception): raise chunk
            yield chunk
async def denied(request, status):
    try: await ns["ocr"](request)
    except HTTPException as error: assert error.status_code == status
    else: raise AssertionError("expected bounded denial")
    assert not ns["_gate"].locked()
async def main():
    for request, status in [(Request([b"ignored"], auth=False), 401), (Request([b"ignored"], mime="text/plain"), 415)]:
        await denied(request, status); assert request.reads == 0
    for length in [None, "1", "999999999"]:
        request = Request([b"a" * (8 * 1024 * 1024), b"b", b"must-not-read"], length=length)
        await denied(request, 413); assert request.reads == 2
    await denied(Request([]), 413)
    disconnected = Request([RuntimeError("synthetic-disconnect")])
    try: await ns["ocr"](disconnected)
    except RuntimeError: pass
    else: raise AssertionError("disconnect must propagate")
    assert not ns["_gate"].locked()
    entered, unblock = asyncio.Event(), asyncio.Event()
    class SlowRequest(Request):
        async def stream(self):
            entered.set(); await unblock.wait(); yield b"synthetic-source"
    first = asyncio.create_task(ns["ocr"](SlowRequest([])))
    await entered.wait()
    second = Request([b"must-not-read"])
    try: await ns["ocr"](second)
    except HTTPException as error: assert error.status_code == 429 and error.detail == "ocr-busy"
    else: raise AssertionError("busy request accepted")
    assert second.reads == 0 and ns["_gate"].locked()
    unblock.set(); success = await first
    assert success.content["imageDigestSha256"] == hashlib.sha256(b"synthetic-source").hexdigest()
    assert success.content["reviewRequired"] is True
    assert not ns["_gate"].locked() and all(not path.exists() for path in engine_paths)
    invalid = image.open
    image.open = lambda body: (_ for _ in ()).throw(InvalidImage())
    await denied(Request([b"invalid"]), 422); image.open = invalid
    def timeout(*args, **kwargs): raise subprocess.TimeoutExpired("synthetic-engine", 1)
    ns["subprocess"].run = timeout
    await denied(Request([b"valid"]), 504)
    class CancelledRequest(Request):
        async def stream(self):
            raise asyncio.CancelledError()
            yield b"unreachable"
    try: await ns["ocr"](CancelledRequest([]))
    except asyncio.CancelledError: pass
    else: raise AssertionError("cancellation must propagate")
    assert not ns["_gate"].locked()
    assert all(not path.exists() for path in temp_paths), "all parser/engine/timeout exits must remove their private temp files"
    print("OCR_HANDLER_BEHAVIOR_PASS")
asyncio.run(main())
`, path.join(root, "workers/local-ai/ocr/app.py")], {
    encoding: "utf8", timeout: 20_000,
    env: { PATH: process.env.PATH, PYTHONDONTWRITEBYTECODE: "1" },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /OCR_HANDLER_BEHAVIOR_PASS/);
});
