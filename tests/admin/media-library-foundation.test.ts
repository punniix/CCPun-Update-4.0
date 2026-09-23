import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CCPUN_VERCEL_PROJECT_IDS } from "../../lib/admin/environment";
import {
  getMediaStorageProviderState,
  isGoogleDriveSelectedFileVerificationEnabled,
  isMediaLibraryEnabled,
  MEDIA_OPERATIONAL_TABLES,
  MEDIA_SCHEMA_MIGRATION_CHECKSUM,
  MEDIA_SCHEMA_MIGRATION_VERSION,
  mediaLibrarySnapshotSchema,
  mediaUploadIntentRequestSchema,
  SYNTHETIC_MEDIA_LIBRARY,
  WEBSITE_42_MEDIA_LIBRARY_BRANCH,
  WEBSITE_42_MEDIA_SANITY_DATASET,
  WEBSITE_42_MEDIA_SANITY_PROJECT_ID,
} from "../../lib/admin/media/foundation";
import {
  MAX_MEDIA_UPLOAD_INTENT_BODY_BYTES,
  validateMediaUploadIntentHttpRequest,
} from "../../lib/admin/media/request-validation";
import {
  createProcessLocalMediaUploadRateLimiter,
  hashMediaUploadRateLimitActor,
} from "../../lib/admin/media/rate-limit";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const enabledInput = {
  flag: "1",
  environment: "admin-uat" as const,
  projectId: CCPUN_VERCEL_PROJECT_IDS.adminProduction,
  gitBranch: WEBSITE_42_MEDIA_LIBRARY_BRANCH,
  sanityProjectId: WEBSITE_42_MEDIA_SANITY_PROJECT_ID,
  sanityDataset: WEBSITE_42_MEDIA_SANITY_DATASET,
};

test("Media Library requires the exact Admin UAT branch and data plane", () => {
  assert.equal(isMediaLibraryEnabled(enabledInput), true);
  for (const change of [
    { flag: "true" },
    { environment: "production-admin" as const },
    { projectId: CCPUN_VERCEL_PROJECT_IDS.web },
    { gitBranch: "v4-production" },
    { gitBranch: "codex/website-42-media-library-foundation-20260828" },
    { gitBranch: "codex/website-42-social-foundation-v2-20260828" },
    { gitBranch: "codex/website-42-social-operations-core-20260828" },
    { gitBranch: "codex/website-42-social-media-integration-20260829" },
    { gitBranch: "codex/unknown-preview" },
    { sanityProjectId: "kyfxgjnq" },
    { sanityDataset: "production" },
  ]) {
    assert.equal(isMediaLibraryEnabled({ ...enabledInput, ...change }), false, JSON.stringify(change));
  }
});

test("selected-file verification is split from synthetic GET and accepts only the centralized UAT or Production runtime", () => {
  const uatEnv = {
    CCPUN_MEDIA_LIBRARY_ENABLED: "1",
    CCPUN_APP_ENV: "admin-uat",
    VERCEL_PROJECT_ID: CCPUN_VERCEL_PROJECT_IDS.adminProduction,
    VERCEL_GIT_COMMIT_REF: WEBSITE_42_MEDIA_LIBRARY_BRANCH,
    NEXT_PUBLIC_SANITY_PROJECT_ID: WEBSITE_42_MEDIA_SANITY_PROJECT_ID,
    NEXT_PUBLIC_SANITY_DATASET: WEBSITE_42_MEDIA_SANITY_DATASET,
  };
  assert.equal(isGoogleDriveSelectedFileVerificationEnabled(uatEnv), true);

  const productionEnv = {
    CCPUN_MEDIA_LIBRARY_ENABLED: "1",
    CCPUN_APP_ENV: "production-admin",
    VERCEL_ENV: "production",
    VERCEL_PROJECT_ID: CCPUN_VERCEL_PROJECT_IDS.adminProduction,
    CCPUN_PRODUCTION_ADMIN_VERCEL_PROJECT_ID: CCPUN_VERCEL_PROJECT_IDS.adminProduction,
    VERCEL_GIT_COMMIT_REF: "v4-production",
    NEXT_PUBLIC_SANITY_PROJECT_ID: "kyfxgjnq",
    NEXT_PUBLIC_SANITY_DATASET: "production",
    CCPUN_NEON_PROJECT_ID: "production-project-id",
    CCPUN_NEON_BRANCH_ID: "br-production-id",
    CCPUN_NEON_ENDPOINT_ID: "ep-production-id",
    CCPUN_NEON_DATABASE: "production_social",
    CCPUN_SOCIAL_DATABASE_URL: "postgresql://ccpun_social_runtime:secret@ep-production-id-pooler.ap-southeast-1.aws.neon.tech/production_social",
  };
  assert.equal(isGoogleDriveSelectedFileVerificationEnabled(productionEnv), true);
  assert.equal(isMediaLibraryEnabled({
    flag: "1",
    environment: "production-admin",
    vercelEnvironment: productionEnv.VERCEL_ENV,
    projectId: productionEnv.VERCEL_PROJECT_ID,
    productionAdminProjectId: productionEnv.CCPUN_PRODUCTION_ADMIN_VERCEL_PROJECT_ID,
    gitBranch: productionEnv.VERCEL_GIT_COMMIT_REF,
    sanityProjectId: productionEnv.NEXT_PUBLIC_SANITY_PROJECT_ID,
    sanityDataset: productionEnv.NEXT_PUBLIC_SANITY_DATASET,
    connectionString: productionEnv.CCPUN_SOCIAL_DATABASE_URL,
    neonProjectId: productionEnv.CCPUN_NEON_PROJECT_ID,
    neonBranchId: productionEnv.CCPUN_NEON_BRANCH_ID,
    neonEndpointId: productionEnv.CCPUN_NEON_ENDPOINT_ID,
    neonDatabase: productionEnv.CCPUN_NEON_DATABASE,
  }), false);
  for (const change of [
    { CCPUN_MEDIA_LIBRARY_ENABLED: "0" },
    { VERCEL_ENV: "preview" },
    { VERCEL_PROJECT_ID: CCPUN_VERCEL_PROJECT_IDS.web },
    { VERCEL_GIT_COMMIT_REF: WEBSITE_42_MEDIA_LIBRARY_BRANCH },
    { NEXT_PUBLIC_SANITY_PROJECT_ID: WEBSITE_42_MEDIA_SANITY_PROJECT_ID },
    { NEXT_PUBLIC_SANITY_DATASET: WEBSITE_42_MEDIA_SANITY_DATASET },
    { CCPUN_NEON_ENDPOINT_ID: "" },
    { CCPUN_SOCIAL_DATABASE_URL: "postgresql://ccpun_social_runtime:secret@ep-other.ap-southeast-1.aws.neon.tech/production_social" },
  ]) {
    assert.equal(isGoogleDriveSelectedFileVerificationEnabled({ ...productionEnv, ...change }), false, JSON.stringify(change));
  }
});

test("Synthetic media fixtures are deterministic metadata without storage URLs", () => {
  const snapshot = mediaLibrarySnapshotSchema.parse(SYNTHETIC_MEDIA_LIBRARY);
  assert.equal(snapshot.mode, "synthetic-uat");
  assert.equal(snapshot.assets.length, 2);
  assert.equal(snapshot.uploadSessions[0]?.status, "blocked");
  assert.equal(snapshot.uploadSessions[0]?.errorCategory, "storage-not-configured");
  assert.deepEqual(getMediaStorageProviderState(), {
    provider: null,
    status: "not-connected",
    directUploadAvailable: false,
  });
  const serialized = JSON.stringify(snapshot);
  assert.equal(/(?:uploadUrl|storageUrl|accessToken|refreshToken|credential)/i.test(serialized), false);
});

test("Upload intent validation accepts metadata only and rejects paths or invalid shape", () => {
  const valid = {
    kind: "image",
    originalFilename: "health-cover.webp",
    mimeType: "image/webp",
    byteSize: 128_000,
    widthPx: 1_080,
    heightPx: 1_350,
    durationMs: null,
    checksumSha256: "c".repeat(64),
    idempotencyKey: "media-upload:test:001",
  } as const;
  assert.equal(mediaUploadIntentRequestSchema.safeParse(valid).success, true);
  assert.equal(mediaUploadIntentRequestSchema.safeParse({ ...valid, originalFilename: "../secret.webp" }).success, false);
  assert.equal(mediaUploadIntentRequestSchema.safeParse({ ...valid, durationMs: 1_000 }).success, false);
  assert.equal(mediaUploadIntentRequestSchema.safeParse({ ...valid, byteSize: 5_000_000_001 }).success, false);
  assert.equal(mediaUploadIntentRequestSchema.safeParse({ ...valid, bytes: "base64-payload" }).success, false);
  for (const control of ["\u0000", "\u001F", "\u007F", "\u0080", "\u009F"]) {
    assert.equal(mediaUploadIntentRequestSchema.safeParse({ ...valid, originalFilename: `unsafe${control}.webp` }).success, false);
    assert.equal(mediaUploadIntentRequestSchema.safeParse({ ...valid, originalFilename: `${control}unsafe.webp` }).success, false);
    assert.equal(mediaUploadIntentRequestSchema.safeParse({ ...valid, originalFilename: `unsafe.webp${control}` }).success, false);
  }
});

test("Upload intent HTTP validator returns deterministic status categories and enforces the byte boundary", () => {
  const validValue = {
    kind: "image",
    originalFilename: "health-cover.webp",
    mimeType: "image/webp",
    byteSize: 128_000,
    widthPx: 1_080,
    heightPx: 1_350,
    durationMs: null,
    checksumSha256: "c".repeat(64),
    idempotencyKey: "media-upload:test:http:001",
  };
  const validBody = JSON.stringify(validValue);
  const validate = (body: string, overrides: Partial<{ contentType: string | null; contentLength: string | null }> = {}) =>
    validateMediaUploadIntentHttpRequest({
      contentType: "application/json; charset=utf-8",
      contentLength: String(Buffer.byteLength(body, "utf8")),
      body,
      ...overrides,
    });

  assert.deepEqual(validate(validBody), { ok: true, data: validValue });
  assert.deepEqual(validate(validBody, { contentType: "multipart/form-data" }), {
    ok: false,
    error: "unsupported-media-type",
    status: 415,
  });
  assert.deepEqual(validate(validBody, { contentLength: null }), {
    ok: false,
    error: "payload-too-large",
    status: 413,
  });
  const exactBoundary = validate(" ".repeat(MAX_MEDIA_UPLOAD_INTENT_BODY_BYTES));
  assert.equal(exactBoundary.ok, false);
  if (exactBoundary.ok) assert.fail("The invalid boundary payload must be rejected");
  assert.equal(exactBoundary.status, 400);
  assert.deepEqual(validate(" ".repeat(MAX_MEDIA_UPLOAD_INTENT_BODY_BYTES + 1)), {
    ok: false,
    error: "payload-too-large",
    status: 413,
  });
  assert.deepEqual(validate("{}"), { ok: false, error: "invalid-input", status: 400 });
  assert.deepEqual(validate(validBody, { contentLength: String(Buffer.byteLength(validBody) - 1) }), {
    ok: false,
    error: "invalid-input",
    status: 400,
  });
});

test("Upload intent rate limiter hashes each actor and returns deterministic Retry-After", () => {
  const actor = "Owner@CCPun.com";
  const hash = hashMediaUploadRateLimitActor(actor);
  assert.equal(hash, hashMediaUploadRateLimitActor(" owner@ccpun.com "));
  assert.notEqual(hash, actor);
  assert.match(hash, /^[0-9a-f]{64}$/);

  const limiter = createProcessLocalMediaUploadRateLimiter({ limit: 2, windowMs: 10_000 });
  assert.deepEqual(limiter.reserve(actor, 1_000), { allowed: true, retryAfterSeconds: 0 });
  assert.deepEqual(limiter.reserve(actor, 2_000), { allowed: true, retryAfterSeconds: 0 });
  assert.deepEqual(limiter.reserve(actor, 2_500), { allowed: false, retryAfterSeconds: 9 });
  assert.deepEqual(limiter.reserve("other@ccpun.com", 2_500), { allowed: true, retryAfterSeconds: 0 });
  assert.deepEqual(limiter.reserve(actor, 11_001), { allowed: true, retryAfterSeconds: 0 });
});

test("Media APIs keep synthetic GET separate from owner-only runtime Drive verification and metadata-only upload intents", () => {
  const listRoute = read("app/api/admin/media/route.ts");
  const driveFoundation = read("lib/admin/media/google-drive-foundation.ts");
  const uploadRoute = read("app/api/admin/media/upload-intents/route.ts");
  const service = read("lib/admin/media/service.ts");

  assert.match(listRoute, /getAdminIdentity\(\)/);
  assert.match(listRoute, /hasAdminPermission\(identity\.role, "social:read"\)/);
  assert.match(listRoute, /isConfiguredAdminOrigin\(request\.url, process\.env\.AUTH_URL\)/);
  assert.match(listRoute, /identity\.actorType !== "human"/);
  assert.match(listRoute, /identity\.role !== "owner"/);
  assert.match(listRoute, /isSameOriginAdminMutation\(request\.url, request\.headers\.get\("origin"\)\)/);
  assert.match(listRoute, /getMediaLibraryRuntimeStatus\(\)\.enabled/);
  assert.match(listRoute, /isGoogleDriveSelectedFileVerificationEnabled\(process\.env\)/);
  assert.match(listRoute, /CCPUN_GOOGLE_DRIVE_ADMIN_ROOT_FOLDER_ID/);
  assert.match(listRoute, /CCPUN_GOOGLE_DRIVE_MEDIA_ROOT_FOLDER_ID/);
  assert.match(listRoute, /validateGoogleDriveProjectionHttpRequest/);
  assert.match(listRoute, /fetchGoogleDriveSelectedFileProjection/);
  assert.match(listRoute, /refreshMode: "manual"/);
  assert.match(listRoute, /export async function POST\(request: Request\)/);
  assert.doesNotMatch(listRoute, /CCPUN_SOCIAL_PROVIDER_WRITES_ENABLED|providerWriteAllowed:\s*true/);
  assert.match(uploadRoute, /hasAdminPermission\(identity\.role, "media:upload"\)/);
  assert.match(uploadRoute, /isSameOriginAdminMutation\(request\.url, request\.headers\.get\("origin"\)\)/);
  assert.match(uploadRoute, /getMediaLibraryRuntimeStatus\(\)\.enabled/);
  assert.match(uploadRoute, /createProcessLocalMediaUploadRateLimiter/);
  assert.match(uploadRoute, /Retry-After/);
  assert.match(uploadRoute, /validateMediaUploadIntentHttpHeaders/);
  assert.match(uploadRoute, /validateMediaUploadIntentHttpRequest/);
  assert.match(uploadRoute, /status: 503/);
  assert.match(service, /import "server-only"/);
  assert.match(service, /bytesAcceptedByApplication: false/);
  assert.match(service, /createHash\("sha256"\)\.update\(input\.idempotencyKey\)/);
  for (const source of [listRoute, uploadRoute, service, driveFoundation]) {
    assert.doesNotMatch(source, /\.formData\(|\.arrayBuffer\(|\.blob\(|request\.body|uploadUrl|storageUrl/);
    assert.doesNotMatch(source, /console\./);
  }
  for (const source of [listRoute, driveFoundation]) {
    assert.doesNotMatch(source, /localStorage|sessionStorage|cookies\(|createClient|INSERT|UPDATE|DELETE/i);
  }
  assert.doesNotMatch(listRoute, /refreshToken|accessToken.*NextResponse|console\./);
});

test("Media migration is additive, checksum-locked and provider-neutral", () => {
  const sql = read("db/migrations/20260828_website_42_media_library_foundation.sql");
  const body = sql.split("-- checksum-source-begin\n")[1]?.split("-- checksum-source-end")[0];
  assert.ok(body);
  const checksum = `sha256:${createHash("sha256").update(body).digest("hex")}`;
  assert.equal(checksum, MEDIA_SCHEMA_MIGRATION_CHECKSUM);
  assert.match(sql, new RegExp(MEDIA_SCHEMA_MIGRATION_VERSION));
  assert.match(sql, new RegExp(MEDIA_SCHEMA_MIGRATION_CHECKSUM));
  for (const table of MEDIA_OPERATIONAL_TABLES) assert.match(sql, new RegExp(table));
  for (const field of ["provider", "bucket_or_store", "object_key", "mime_type", "byte_size", "checksum_sha256", "etag", "visibility", "status"]) {
    assert.match(sql, new RegExp(`\\b${field}\\b`));
  }
  assert.match(sql, /upload_method text NOT NULL CHECK \(upload_method = 'direct'\)/);
  assert.match(sql, /idempotency_key text NOT NULL UNIQUE/);
  assert.match(sql, /actor_ref text NOT NULL/);
  assert.match(sql, /request_ref text NOT NULL/);
  assert.match(sql, /social_variant_media_singleton_role_idx/);
  assert.doesNotMatch(sql, /access_token|refresh_token|credential|signed_url|upload_url/i);
});

test("Distribution Overview owns the root route while the Media Library presentation is retained", () => {
  const page = read("features/admin/social/page.tsx");
  const mediaSection = read("features/admin/media/MediaLibraryUatSection.tsx");
  const route = read("app/(control-plane)/social/page.tsx");
  const navigation = read("app/(control-plane)/layout.tsx");
  assert.match(page, /getMediaLibraryRuntimeStatus/);
  assert.match(page, /MediaLibraryUatSection/);
  assert.doesNotMatch(mediaSection, /text-white\/45/);
  assert.match(mediaSection, /text-white\/55/);
  assert.match(mediaSection, /GOOGLE DRIVE · เฉพาะไฟล์ที่เลือก/);
  assert.match(mediaSection, /เลือกไฟล์จาก Google Drive/);
  assert.match(mediaSection, /อัปเดตรายละเอียดไฟล์/);
  assert.match(mediaSection, /ให้เจ้าของอนุญาตสิทธิ์เฉพาะไฟล์แบบชั่วคราว/);
  assert.equal((mediaSection.match(/disabled aria-disabled="true"/g) ?? []).length, 2);
  assert.equal(route.trim(), 'export { metadata, default } from "@/features/admin/social/control-plane-page";');
  assert.doesNotMatch(page, /redirect\(/);
  assert.equal((navigation.match(/\{ href: "\/social\/"/g) ?? []).length, 1);
});

test("Google Picker and GIS use only their exact CSP origins", () => {
  const policy = read("lib/security-policy.ts");
  assert.match(policy, /script-src[^\n]*https:\/\/apis\.google\.com https:\/\/accounts\.google\.com/);
  assert.match(policy, /connect-src[^\n]*https:\/\/www\.googleapis\.com https:\/\/accounts\.google\.com/);
  assert.match(policy, /frame-src[^\n]*https:\/\/accounts\.google\.com https:\/\/docs\.google\.com/);
  assert.doesNotMatch(policy, /https:\/\/\*\.(?:googleapis|google)\.com/);
});
