import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  documentUploadIdempotencyDigest,
  getLineProviderActivationReadiness,
} from "../../lib/admin/line/document-media";
import {
  fetchLineMediaContent,
  getLineMediaProviderReadiness,
} from "../../lib/admin/line/media-provider";
import { classifyLineProviderFailure } from "../../lib/admin/line/provider-classification";
import {
  activateDefaultLineRichMenu,
  buildLineRichMenuProviderDefinition,
} from "../../lib/admin/line/rich-menu-provider";
import { createCustomerDriveProvider } from "../../lib/admin/line/customer-drive-provider";
import {
  GOOGLE_DRIVE_FILE_SCOPE,
  GOOGLE_DRIVE_FOLDER_MIME_TYPE,
} from "../../lib/admin/media/google-drive-foundation";
import {
  LINE_RICH_MENU_ITEMS,
  LINE_RICH_MENU_V1,
} from "../../lib/line/ecosystem";

const root = path.resolve(import.meta.dirname, "../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const migrationChecksum = "fcab7e746a62850711493cfa849548975c6dfdb8365417d3b142fdc26ae1026f";

function checksumBody(sql: string) {
  return sql.split("-- checksum-source-begin\n", 2)[1]?.split("-- checksum-source-end", 1)[0] ?? "";
}

function normalized(sql: string) {
  return sql
    .replaceAll("20260918_line_attribution_privacy_ops_fix_v1_uat", "PREVIOUS")
    .replaceAll("20260918_line_attribution_privacy_ops_fix_v1_production", "PREVIOUS")
    .replaceAll("20260918_line_document_media_activation_v1_uat", "THIS")
    .replaceAll("20260918_line_document_media_activation_v1_production", "THIS")
    .replaceAll("20260918_line_delivery_activation_v1_uat", "DELIVERY")
    .replaceAll("20260918_line_delivery_activation_v1_production", "DELIVERY")
    .replaceAll("young-term-47483330", "PROJECT")
    .replaceAll("lively-bar-43618798", "PROJECT")
    .replaceAll("br-crimson-mouse-az7ajkv8", "BRANCH")
    .replaceAll("br-long-resonance-b3ys5xrv", "BRANCH")
    .replaceAll("ep-mute-frost-aztvz394", "ENDPOINT")
    .replaceAll("ep-broad-butterfly-b3ro7u8w", "ENDPOINT")
    .replaceAll("20260917_private_line_runtime_v1_uat", "BASE")
    .replaceAll("20260917_private_line_runtime_v1_production", "BASE");
}

test("document/media migrations are UAT/Production parity and checksum locked", () => {
  const uat = read("db/migrations/20260918_line_document_media_activation_v1_uat.sql");
  const production = read("db/migrations/20260918_line_document_media_activation_v1_production.sql");
  assert.equal(normalized(uat), normalized(production));
  assert.equal(checksumBody(uat), checksumBody(production));
  assert.equal(createHash("sha256").update(checksumBody(uat)).digest("hex"), migrationChecksum);
  assert.match(uat, new RegExp(`sha256:${migrationChecksum}`));
  assert.match(production, new RegExp(`sha256:${migrationChecksum}`));
});

test("delivery activation migration is parity locked and makes retry classification fail-closed", () => {
  const uat = read("db/migrations/20260918_line_delivery_activation_v1_uat.sql");
  const production = read("db/migrations/20260918_line_delivery_activation_v1_production.sql");
  const deliveryChecksum = "0ae7539cbc55299979f1821984875181e66259efec4ddc16cc3e549a056eabfa";
  assert.equal(normalized(uat), normalized(production));
  assert.equal(checksumBody(uat), checksumBody(production));
  assert.equal(createHash("sha256").update(checksumBody(uat)).digest("hex"), deliveryChecksum);
  assert.match(uat, new RegExp(`sha256:${deliveryChecksum}`));
  assert.match(production, new RegExp(`sha256:${deliveryChecksum}`));
  assert.match(production, /rate_limited','provider_unavailable'[\s\S]*'retryable'/);
  assert.match(production, /provider_result_ambiguous'[\s\S]*'ambiguous'/);
  assert.match(production, /line_delivery_retry_class\(om\.last_error_class\)='retryable'/);
  assert.match(production, /line_delivery_retry_class\(d\.last_error_class\)='retryable'/);
  assert.match(production, /outbound_dead_letter bigint/);
  assert.match(production, /campaign_dead_letter bigint/);
  assert.doesNotMatch(
    production.match(/CREATE OR REPLACE FUNCTION private_line\.admin_read_line_delivery_health[\s\S]*?\$admin_read_line_delivery_health\$;/)?.[0] ?? "",
    /lead_id|customer|message_text|cipher|nonce|auth_tag|external_ref/i,
  );
});

test("provider failure classifier matches retry/dead-letter contract", () => {
  assert.deepEqual(classifyLineProviderFailure(429), {
    errorClass: "rate_limited",
    retryClass: "retryable",
  });
  assert.deepEqual(classifyLineProviderFailure(503), {
    errorClass: "provider_unavailable",
    retryClass: "retryable",
  });
  assert.deepEqual(classifyLineProviderFailure(400), {
    errorClass: "provider_rejected",
    retryClass: "permanent",
  });
});

test("document/media storage is private, idempotent, and preserves an unsend revoke target", () => {
  const sql = read("db/migrations/20260918_line_document_media_activation_v1_production.sql");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS private_line\.customer_drive_folder/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS private_line\.document_storage_object/);
  assert.match(sql, /upload_idempotency_digest text UNIQUE/);
  assert.match(sql, /permission_state text NOT NULL DEFAULT 'unverified'.*'private'.*'unsafe'/);
  assert.match(sql, /AFTER INSERT OR UPDATE OF status,external_file_id,external_folder_id ON private_line\.document/);
  assert.match(sql, /COALESCE\(OLD\.external_file_id,NEW\.external_file_id\)/);
  assert.match(sql, /status='revoke_required'/);
  assert.match(sql, /external_file_id=CASE WHEN v_result IN \('revoked','deleted'\) THEN NULL/);
  assert.match(sql, /REVOKE ALL PRIVILEGES ON TABLE[\s\S]*private_line\.document_storage_object[\s\S]*FROM ccpun_admin_runtime/);
  assert.match(sql, /REVOKE ALL PRIVILEGES ON TABLE[\s\S]*private_line\.document_media_attempt[\s\S]*FROM ccpun_line_ingress/);
  assert.doesNotMatch(sql, /GRANT (?:SELECT|INSERT|UPDATE|DELETE) ON (?:TABLE )?private_line\.(?:customer_drive_folder|document_storage_object|document_media_attempt)/);
});

test("runtime verification records only safe booleans and remains ingress-only", () => {
  const sql = read("db/migrations/20260918_line_document_media_activation_v1_production.sql");
  const fn = sql.match(/CREATE OR REPLACE FUNCTION private_line\.ingress_record_line_runtime_health[\s\S]*?\$ingress_record_line_runtime_health\$;/);
  assert.ok(fn);
  assert.match(fn[0], /active_version/);
  assert.match(fn[0], /v1_key_present/);
  assert.match(fn[0], /v2_key_present/);
  assert.match(fn[0], /lazy_rotation_enabled/);
  assert.doesNotMatch(fn[0], /identity|customer|message|ciphertext|external_ref|line_user/i);
  assert.match(sql, /REVOKE ALL ON FUNCTION private_line\.ingress_record_line_runtime_health\(jsonb\) FROM PUBLIC/);
  assert.match(sql, /REVOKE ALL ON FUNCTION private_line\.ingress_record_line_runtime_health\(jsonb\) FROM ccpun_admin_runtime/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION private_line\.ingress_record_line_runtime_health\(jsonb\) TO ccpun_line_ingress/);

  const ingress = read("apps/web/lib/line/private-ingestion.ts");
  assert.match(ingress, /recordLineRuntimeHealthBestEffort/);
  assert.match(ingress, /active_version: crypto\.keyVersion/);
  assert.match(ingress, /v1_key_present: crypto\.hasKeyVersion\(1\)/);
  assert.match(ingress, /v2_key_present: crypto\.hasKeyVersion\(2\)/);
  assert.doesNotMatch(
    ingress.match(/function lineRuntimeHealthPayload[\s\S]*?\n\}/)?.[0] ?? "",
    /identityDigest|providerMessage|ciphertext|message-content/,
  );
});

test("document fetch source and Drive identifiers are server-only and excluded from safe advisor view", () => {
  const sql = read("db/migrations/20260918_line_document_media_activation_v1_production.sql");
  assert.match(sql, /REVOKE ALL ON FUNCTION private_line\.admin_read_document_fetch_source\(uuid\) FROM PUBLIC/);
  assert.match(sql, /REVOKE ALL ON FUNCTION private_line\.admin_read_document_fetch_source\(uuid\) FROM ccpun_line_ingress/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION private_line\.admin_read_document_fetch_source\(uuid\) TO ccpun_admin_runtime/);
  const safeViewMigration = read("db/migrations/20260918_line_safe_knowledge_crm_campaign_v1_production.sql");
  const safeView = safeViewMigration.match(/CREATE OR REPLACE VIEW private_line\.advisor_document_safe[\s\S]*?;/);
  assert.ok(safeView);
  assert.doesNotMatch(safeView[0], /external_file_id|external_folder_id|drive|idempotency|cipher|nonce|auth_tag/i);
});

test("document upload digest is deterministic without encoding customer data", () => {
  const first = documentUploadIdempotencyDigest("11111111-1111-4111-8111-111111111111");
  const again = documentUploadIdempotencyDigest("11111111-1111-4111-8111-111111111111");
  const other = documentUploadIdempotencyDigest("22222222-2222-4222-8222-222222222222");
  assert.match(first, /^[0-9a-f]{64}$/);
  assert.equal(first, again);
  assert.notEqual(first, other);
  assert.doesNotMatch(first, /11111111/);
});

test("provider readiness reports booleans only and cannot reveal a LINE token", () => {
  const token = "SYNTHETIC_LINE_TOKEN_MUST_NOT_LEAK";
  const readiness = getLineProviderActivationReadiness({
    CCPUN_LINE_ACTIVE_ENCRYPTION_KEY_VERSION: "2",
    CCPUN_LINE_ENCRYPTION_KEY_V2: Buffer.alloc(32, 4).toString("base64"),
    CCPUN_LINE_CHANNEL_ACCESS_TOKEN: token,
    CCPUN_LINE_OUTBOUND_ENABLED: "true",
    CCPUN_LINE_RICH_MENU_PROVIDER_ENABLED: "true",
  });
  assert.equal(readiness.channelTokenPresent, true);
  assert.equal(readiness.outboundWriteGateEnabled, true);
  assert.equal(readiness.richMenuWriteGateEnabled, true);
  assert.equal(readiness.driveScope, "drive.file");
  assert.equal(readiness.drivePersistentCredentialConfigured, false);
  assert.doesNotMatch(JSON.stringify(readiness), new RegExp(token));

  assert.deepEqual(getLineMediaProviderReadiness({}), { tokenPresent: false, fetchEnabled: false });
});

test("LINE media fetch is fail-closed and classifies safe provider status without content leakage", async () => {
  let calls = 0;
  const disabled = await fetchLineMediaContent(
    "provider_1234567890",
    {},
    async () => {
      calls += 1;
      return new Response(null, { status: 200 });
    },
  );
  assert.deepEqual(disabled, { ok: false, status: "not_configured" });
  assert.equal(calls, 0);

  for (const [statusCode, expected] of [[202, "processing"], [404, "gone"], [429, "rate_limited"], [503, "provider_unavailable"]] as const) {
    const result = await fetchLineMediaContent(
      "provider_1234567890",
      {
        CCPUN_LINE_CHANNEL_ACCESS_TOKEN: "synthetic-token",
        CCPUN_LINE_MEDIA_FETCH_ENABLED: "true",
      },
      async () => new Response(null, { status: statusCode }),
    );
    assert.equal(result.ok, false);
    if (result.ok) assert.fail("provider error must not be ready");
    assert.equal(result.status, expected);
    assert.doesNotMatch(JSON.stringify(result), /synthetic-token/);
  }
});

test("Rich Menu definition is versioned, deterministic, complete, and provider writes are gated", async () => {
  assert.equal(LINE_RICH_MENU_V1.version, "line-rich-menu-v1");
  assert.deepEqual(LINE_RICH_MENU_V1.size, { width: 2500, height: 1686 });
  assert.equal(LINE_RICH_MENU_V1.areas.length, LINE_RICH_MENU_ITEMS.length);
  assert.equal(LINE_RICH_MENU_V1.image.maxBytes, 1_000_000);
  const definition = buildLineRichMenuProviderDefinition();
  assert.equal(definition.areas.length, 6);
  assert.match(JSON.stringify(definition), /journey=life_health_policy_review&stage=entry/);
  assert.match(JSON.stringify(definition), /journey=investment_before_you_act&stage=entry/);
  assert.match(JSON.stringify(definition), /journey=motor_quote_review&stage=entry/);

  let calls = 0;
  const result = await activateDefaultLineRichMenu(
    new Blob(["synthetic"], { type: "image/png" }),
    {},
    async () => {
      calls += 1;
      return new Response(null, { status: 500 });
    },
  );
  assert.deepEqual(result, { ok: false, status: "not_configured" });
  assert.equal(calls, 0);
});

test("Rich Menu provider follows validate/create/upload/default sequence only when explicitly enabled", async () => {
  const calls: Array<{ url: string; method: string }> = [];
  const result = await activateDefaultLineRichMenu(
    new Blob(["synthetic-image"], { type: "image/png" }),
    {
      CCPUN_LINE_CHANNEL_ACCESS_TOKEN: "synthetic-token",
      CCPUN_LINE_RICH_MENU_PROVIDER_ENABLED: "true",
    },
    async (input, init) => {
      const url = String(input);
      calls.push({ url, method: init?.method ?? "GET" });
      if (url.endsWith("/v2/bot/richmenu/validate")) return new Response(null, { status: 200 });
      if (url.endsWith("/v2/bot/richmenu")) {
        return new Response(JSON.stringify({ richMenuId: "richmenu-synthetic123" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.includes("/richmenu/richmenu-synthetic123/content")) return new Response(null, { status: 200 });
      if (url.includes("/user/all/richmenu/richmenu-synthetic123")) return new Response(null, { status: 200 });
      return new Response(null, { status: 500 });
    },
  );
  assert.deepEqual(result, { ok: true, status: "assigned", richMenuId: "richmenu-synthetic123" });
  assert.equal(calls.length, 4);
  assert.deepEqual(calls.map((call) => call.method), ["POST", "POST", "POST", "POST"]);
  assert.doesNotMatch(JSON.stringify(result), /synthetic-token/);
});

test("Customer Drive provider requires drive.file memory-only auth and rejects public/shared ACL", async () => {
  const nowMs = 20_000;
  const rootFolderId = "synthetic_root_folder_12345";
  const authorization = {
    scope: GOOGLE_DRIVE_FILE_SCOPE,
    mode: "owner-interactive",
    tokenPersistence: "memory-only",
    refreshTokenPersistence: "forbidden",
    issuedAtMs: 10_000,
    expiresAtMs: 100_000,
  } as const;

  assert.deepEqual(createCustomerDriveProvider({
    accessToken: "synthetic",
    authorization: { ...authorization, scope: "https://www.googleapis.com/auth/drive.readonly" } as never,
    nowMs,
    rootFolderId,
  }), { ready: false, reason: "invalid-authorization" });

  const provider = createCustomerDriveProvider({
    accessToken: "synthetic-memory-only-token",
    authorization,
    nowMs,
    rootFolderId,
  }, async (input) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith(`/files/${rootFolderId}`)) {
      return new Response(JSON.stringify({
        id: rootFolderId,
        mimeType: GOOGLE_DRIVE_FOLDER_MIME_TYPE,
        parents: [],
        trashed: false,
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.pathname.endsWith(`/files/${rootFolderId}/permissions`)) {
      return new Response(JSON.stringify({
        permissions: [
          { type: "user", role: "owner" },
          { type: "anyone", role: "reader" },
        ],
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(null, { status: 500 });
  });
  assert.equal(provider.ready, true);
  if (!provider.ready) assert.fail("synthetic provider should be ready");
  assert.deepEqual(await provider.ensureCustomerFolder("a".repeat(64)), {
    ok: false,
    status: "unsafe_permissions",
  });
});

test("Customer Drive dedupe reuses one private appProperty-matched file instead of uploading a duplicate", async () => {
  const rootFolderId = "synthetic_root_folder_12345";
  const customerFolderId = "synthetic_customer_folder_12345";
  const fileId = "synthetic_document_file_12345";
  const authorization = {
    scope: GOOGLE_DRIVE_FILE_SCOPE,
    mode: "owner-interactive",
    tokenPersistence: "memory-only",
    refreshTokenPersistence: "forbidden",
    issuedAtMs: 10_000,
    expiresAtMs: 100_000,
  } as const;
  let uploadCalls = 0;
  const provider = createCustomerDriveProvider({
    accessToken: "synthetic-memory-only-token",
    authorization,
    nowMs: 20_000,
    rootFolderId,
  }, async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith(`/files/${customerFolderId}`) && !url.pathname.endsWith("/permissions")) {
      return new Response(JSON.stringify({
        id: customerFolderId,
        mimeType: GOOGLE_DRIVE_FOLDER_MIME_TYPE,
        parents: [rootFolderId],
        trashed: false,
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.pathname.endsWith(`/files/${customerFolderId}/permissions`) || url.pathname.endsWith(`/files/${fileId}/permissions`)) {
      return new Response(JSON.stringify({ permissions: [{ type: "user", role: "owner" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (url.pathname === "/drive/v3/files" && init?.method === "GET") {
      return new Response(JSON.stringify({
        files: [{ id: fileId, mimeType: "application/pdf", parents: [customerFolderId], trashed: false }],
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.pathname.includes("/upload/drive/v3/files")) uploadCalls += 1;
    return new Response(null, { status: 500 });
  });
  assert.equal(provider.ready, true);
  if (!provider.ready) assert.fail("synthetic provider should be ready");
  const result = await provider.uploadDocument({
    externalFolderId: customerFolderId,
    documentDigest: "b".repeat(64),
    mimeType: "application/pdf",
    body: new Blob(["synthetic pdf"], { type: "application/pdf" }),
  });
  assert.deepEqual(result, { ok: true, status: "already_stored", externalFileId: fileId });
  assert.equal(uploadCalls, 0);
  assert.doesNotMatch(JSON.stringify(result), /memory-only-token/);
});

test("new LINE/Drive provider modules never persist refresh tokens or emit generic analytics", () => {
  const sources = [
    read("lib/admin/line/document-media.ts"),
    read("lib/admin/line/media-provider.ts"),
    read("lib/admin/line/customer-drive-provider.ts"),
    read("lib/admin/line/rich-menu-provider.ts"),
  ].join("\n");
  assert.doesNotMatch(sources, /localStorage|sessionStorage|cookies?\.|refresh_token|CCPUN_GOOGLE.*REFRESH|SEO.*TOKEN/i);
  assert.doesNotMatch(sources, /\bgtag\b|\bfbq\b|dataLayer|google-analytics|meta pixel/i);
  assert.doesNotMatch(sources, /console\./);
});

test("Admin health surface stays aggregate/boolean and does not project private identifiers", () => {
  const page = read("apps/admin/app/(control-plane)/operations/health/page.tsx");
  assert.match(page, /LINE และไฟล์ลูกค้า/);
  assert.match(page, /การเข้ารหัสล่าสุด/);
  assert.match(page, /โฟลเดอร์ที่ต้องตรวจสิทธิ์/);
  assert.match(page, /เชื่อม LINE/);
  assert.doesNotMatch(page, /LINE Runtime \/ Customer Media|Web active V2|Unsafe Drive folders|LINE token/);
  assert.doesNotMatch(page, /externalFolderId|externalFileId|providerMessageId|LINE user ID.*value=/);
});
