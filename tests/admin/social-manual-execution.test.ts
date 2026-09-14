import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { executeSocialPublication } from "../../lib/admin/social/execution-store";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const enabledEnv = {
  CCPUN_SOCIAL_PROVIDER_WRITES_ENABLED: "1",
  CCPUN_SOCIAL_OPERATIONS_ENABLED: "1",
  CCPUN_APP_ENV: "admin-uat",
  VERCEL_PROJECT_ID: "prj_6tuUxJxYbQ4mpF7sMgNWx2p2jowN",
  VERCEL_GIT_COMMIT_REF: "codex/website-42-social-analytics-ingestion-20260831",
  NEXT_PUBLIC_SANITY_PROJECT_ID: "ccb9lnw5",
  NEXT_PUBLIC_SANITY_DATASET: "uat",
  CCPUN_NEON_PROJECT_ID: "young-term-47483330",
  CCPUN_NEON_BRANCH_ID: "br-crimson-mouse-az7ajkv8",
  CCPUN_NEON_ENDPOINT_ID: "ep-mute-frost-aztvz394",
  CCPUN_NEON_DATABASE: "neondb",
  CCPUN_SOCIAL_DATABASE_URL: "postgresql://ccpun_social_runtime:secret@ep-mute-frost-aztvz394-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb",
  CCPUN_META_ACCESS_TOKEN: "meta-secret",
  CCPUN_META_GRAPH_VERSION: "v26.0",
  CCPUN_META_GRANTED_SCOPES: "pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish",
};
const approvedSha256 = "a".repeat(64);
const publicationKey = "social-execution:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function commentId(position: number) {
  return `comment:${createHash("sha256").update(`${publicationKey}:comment:${position}`).digest("hex").slice(0, 32)}`;
}

type FakeRow = Record<string, unknown> & {
  publication_id: string;
  publication_status: string;
  platform_object_id: string | null;
  published_at: string | null;
  execution_target: string;
  job_id: string;
  job_status: string;
  job_version: number;
  attempt_count: number;
  max_attempts: number;
  lock_owner: string | null;
  lock_expires_at: string | null;
  last_error_category: string | null;
};

function baseRow(overrides: Record<string, unknown> = {}): FakeRow {
  return {
    publication_id: "publication:001",
    variant_id: "socialVariant-001",
    publication_status: "approved",
    execution_target: "facebook-publish-now",
    scheduled_at: null,
    platform_object_id: null,
    published_at: null,
    approved_revision: "rev-1",
    approved_version: 1,
    approved_at: "2026-09-01T00:00:00.000Z",
    approval_request_ref: "approval-001",
    publication_idempotency_key: publicationKey,
    channel: "facebook",
    format: "text-post",
    publishing_mode: "direct",
    job_id: "job:001",
    job_type: "publish",
    job_status: "queued",
    job_version: 1,
    attempt_count: 0,
    max_attempts: 3,
    lock_owner: null,
    lock_expires_at: null,
    job_idempotency_key: `${publicationKey}:job`,
    last_error_category: null,
    ...overrides,
  } as FakeRow;
}

function approvedVariant(overrides: Record<string, unknown> = {}) {
  return {
    variantId: "socialVariant-001",
    revision: "rev-1",
    version: 1,
    masterContentId: "master-001",
    platform: "facebook" as const,
    format: "text-post" as const,
    publishingMode: "direct" as const,
    reviewStatus: "approved" as const,
    title: "CCPun post",
    caption: "ข้อความ CCPun",
    linkUrl: null,
    commentSeriesMode: "top-level" as const,
    commentSeries: [],
    mediaMetadata: [],
    publication: null,
    ...overrides,
  };
}

function fakeSql(initial = baseRow(), initialComments: Array<{
  id: string; position: number; parent_item_id: string | null;
  status: "approved" | "processing" | "published" | "failed";
  platform_comment_id: string | null;
}> = []) {
  const state = { row: { ...initial }, comments: initialComments.map((comment) => ({ ...comment })), queries: [] as string[] };
  return {
    state,
    sql: {
      async query(query: string, params: unknown[] = []) {
        state.queries.push(query);
        if (query.includes("social-execution:load-comments")) return state.comments;
        if (query.includes("social-execution:load")) return [state.row];
        if (query.includes("social-execution:deny")) return [];
        if (query.includes("social-execution:claim")) {
          if (state.row.job_version !== params[2]
            || !(state.row.job_status === "queued" || (state.row.job_status === "failed" && state.row.last_error_category === "rate-limit"))) return [];
          state.row.job_status = "processing";
          state.row.publication_status = "processing";
          state.row.job_version += 1;
          state.row.attempt_count += 1;
          state.row.lock_owner = String(params[3]);
          state.row.lock_expires_at = String(params[5]);
          state.row.last_error_category = null;
          return [{
            job_id: state.row.job_id,
            version: state.row.job_version,
            attempt_count: state.row.attempt_count,
            max_attempts: state.row.max_attempts,
            lock_owner: state.row.lock_owner,
            lock_expires_at: state.row.lock_expires_at,
          }];
        }
        if (query.includes("social-execution:checkpoint-main")) {
          state.row.platform_object_id = String(params[4]);
          return [{ publication_id: state.row.publication_id }];
        }
        if (query.includes("social-execution:comment-start")) {
          const comment = state.comments.find((item) => item.id === params[4]);
          if (!comment || comment.status !== "approved") return [];
          comment.status = "processing";
          return [{ comment_id: comment.id }];
        }
        if (query.includes("social-execution:comment-finish")) {
          const comment = state.comments.find((item) => item.id === params[4]);
          if (!comment || comment.status !== "processing") return [];
          comment.status = "published";
          comment.platform_comment_id = String(params[5]);
          return [{ comment_id: comment.id }];
        }
        if (query.includes("social-execution:comment-reset")) {
          const comment = state.comments.find((item) => item.id === params[1]);
          if (comment?.status === "processing" && !comment.platform_comment_id) comment.status = "approved";
          return [];
        }
        if (query.includes("social-execution:finish")) {
          state.row.job_status = "succeeded";
          state.row.job_version += 1;
          state.row.publication_status = String(params[4]);
          state.row.platform_object_id = String(params[5]);
          state.row.published_at = params[6] === null ? null : String(params[6]);
          state.row.lock_owner = null;
          state.row.lock_expires_at = null;
          return [{ publication_id: state.row.publication_id }];
        }
        if (query.includes("social-execution:fail")) {
          state.row.job_status = "failed";
          state.row.job_version += 1;
          state.row.publication_status = "failed";
          state.row.last_error_category = String(params[4]);
          state.row.lock_owner = null;
          state.row.lock_expires_at = null;
          return [{ publication_id: state.row.publication_id }];
        }
        throw new Error("UNEXPECTED_TEST_QUERY");
      },
    },
  };
}

test("Provider-write flag off fails before database, Sanity or Meta", async () => {
  let touched = false;
  await assert.rejects(executeSocialPublication({
    request: { publicationId: "publication:001", expectedJobVersion: 1 },
    actor: "owner@example.com",
    requestId: "request-flag-off",
    env: { ...enabledEnv, CCPUN_SOCIAL_PROVIDER_WRITES_ENABLED: "0" },
    dependencies: {
      sql: { query: async () => { touched = true; return []; } },
      readVariant: async () => { touched = true; return null; },
      fetcher: async () => { touched = true; return new Response(); },
    },
  }), /SOCIAL_PROVIDER_WRITES_NOT_CONFIGURED/);
  assert.equal(touched, false);
});

test("Stale Sanity revision fails the claimed job before any Meta request", async () => {
  const database = fakeSql();
  let providerCalls = 0;
  await assert.rejects(executeSocialPublication({
    request: { publicationId: "publication:001", expectedJobVersion: 1 },
    actor: "owner@example.com",
    requestId: "request-stale-revision",
    env: enabledEnv,
    dependencies: {
      sql: database.sql,
      readVariant: async () => approvedVariant({ revision: "rev-2", version: 2 }),
      fetcher: async () => { providerCalls += 1; return new Response(); },
      now: () => new Date("2026-09-01T00:00:00.000Z"),
    },
  }), /SOCIAL_EXECUTION_EDITORIAL_CONFLICT/);
  assert.equal(providerCalls, 0);
  assert.equal(database.state.row.job_status, "failed");
  assert.equal(database.state.row.publication_status, "failed");
  assert.equal(database.state.row.last_error_category, "conflict");
});

test("CAS conflict and a completed replay never call Meta", async () => {
  for (const scenario of [
    { row: baseRow({ job_version: 2 }), expected: 1, error: /SOCIAL_EXECUTION_CAS_CONFLICT/ },
    { row: baseRow({ job_status: "succeeded", publication_status: "published", platform_object_id: "post-1", published_at: "2026-09-01T00:01:00.000Z" }), expected: 2, error: null },
  ]) {
    const database = fakeSql(scenario.row);
    let providerCalls = 0;
    const operation = executeSocialPublication({
      request: { publicationId: "publication:001", expectedJobVersion: scenario.expected },
      actor: "owner@example.com",
      requestId: `request-cas-${scenario.expected}`,
      env: enabledEnv,
      dependencies: {
        sql: database.sql,
        readVariant: async () => approvedVariant(),
        fetcher: async () => { providerCalls += 1; return new Response(); },
      },
    });
    if (scenario.error) await assert.rejects(operation, scenario.error);
    else assert.equal((await operation).state, "replay");
    assert.equal(providerCalls, 0);
    assert.equal(database.state.queries.some((query) => query.includes("social-execution:claim")), false);
  }
});

test("Instagram mobile handoff and direct media execution are denied without provider calls", async () => {
  for (const row of [
    baseRow({
      publication_status: "awaiting-native-finish", execution_target: "instagram-mobile-handoff",
      channel: "instagram", format: "reel", publishing_mode: "native-finish", job_type: "native-handoff",
    }),
    baseRow({ execution_target: "instagram-publish-now", channel: "instagram", format: "reel", publishing_mode: "direct" }),
  ]) {
    const database = fakeSql(row);
    let providerCalls = 0;
    await assert.rejects(executeSocialPublication({
      request: { publicationId: "publication:001", expectedJobVersion: 1 },
      actor: "owner@example.com",
      requestId: `request-ig-${row.execution_target}`,
      env: enabledEnv,
      dependencies: {
        sql: database.sql,
        readVariant: async () => null,
        fetcher: async () => { providerCalls += 1; return new Response(); },
      },
    }), row.execution_target === "instagram-mobile-handoff" ? /SOCIAL_EXECUTION_MOBILE_HANDOFF_ONLY/ : /SOCIAL_EXECUTION_TRUSTED_MEDIA_REQUIRED/);
    assert.equal(providerCalls, 0);
    assert.equal(database.state.queries.some((query) => query.includes("social-execution:claim")), false);
  }
});

test("Facebook media formats and legacy aliases validate as media contracts then stop at the trusted-delivery blocker", async () => {
  const formats = [
    { format: "image-post", media: [{ assetId: "image-1", role: "primary", order: 1, mimeType: "image/jpeg", sha256Checksum: approvedSha256, widthPx: 1200, heightPx: 1200, durationMs: null }] },
    { format: "photo-post", media: [{ assetId: "image-1", role: "primary", order: 1, mimeType: "image/jpeg", sha256Checksum: approvedSha256, widthPx: 1200, heightPx: 1200, durationMs: null }] },
    { format: "album", media: [
      { assetId: "image-1", role: "carousel-item", order: 1, mimeType: "image/jpeg", sha256Checksum: approvedSha256, widthPx: 1200, heightPx: 1200, durationMs: null },
      { assetId: "image-2", role: "carousel-item", order: 2, mimeType: "image/png", sha256Checksum: approvedSha256, widthPx: 1200, heightPx: 1200, durationMs: null },
    ] },
    { format: "carousel", media: [
      { assetId: "image-1", role: "carousel-item", order: 1, mimeType: "image/jpeg", sha256Checksum: approvedSha256, widthPx: 1200, heightPx: 1200, durationMs: null },
      { assetId: "image-2", role: "carousel-item", order: 2, mimeType: "image/png", sha256Checksum: approvedSha256, widthPx: 1200, heightPx: 1200, durationMs: null },
    ] },
    { format: "video", media: [{ assetId: "video-1", role: "primary", order: 1, mimeType: "video/mp4", sha256Checksum: approvedSha256, widthPx: 1080, heightPx: 1920, durationMs: 30_000 }] },
    { format: "reel", media: [{ assetId: "reel-1", role: "primary", order: 1, mimeType: "video/mp4", sha256Checksum: approvedSha256, widthPx: 1080, heightPx: 1920, durationMs: 30_000 }] },
  ] as const;
  for (const item of formats) {
    const database = fakeSql(baseRow({ format: item.format }));
    let providerCalls = 0;
    await assert.rejects(executeSocialPublication({
      request: { publicationId: "publication:001", expectedJobVersion: 1 },
      actor: "owner@example.com",
      requestId: `request-facebook-${item.format}`,
      env: enabledEnv,
      dependencies: {
        sql: database.sql,
        readVariant: async () => approvedVariant({ format: item.format, mediaMetadata: item.media }),
        fetcher: async () => { providerCalls += 1; return new Response(); },
        now: () => new Date("2026-09-01T00:00:00.000Z"),
      },
    }), /SOCIAL_EXECUTION_TRUSTED_MEDIA_REQUIRED/);
    assert.equal(providerCalls, 0);
    assert.equal(database.state.row.last_error_category, "conflict");
  }
});

test("Approved Drive binary is revalidated ephemerally then streamed to a Facebook image post without persisting its token", async () => {
  const assetId = "drive_file_image_001";
  const database = fakeSql(baseRow({ format: "image-post" }));
  let driveCalls = 0;
  const metaRequests: Array<{ url: string; authorization: string; contentType: string }> = [];
  const result = await executeSocialPublication({
    request: {
      publicationId: "publication:001",
      expectedJobVersion: 1,
      driveMedia: {
        accessToken: "ephemeral-drive-token",
        authorization: {
          scope: "https://www.googleapis.com/auth/drive.file",
          mode: "owner-interactive",
          tokenPersistence: "memory-only",
          refreshTokenPersistence: "forbidden",
          issuedAtMs: Date.parse("2026-09-01T00:00:00.000Z"),
          expiresAtMs: Date.parse("2026-09-01T00:30:00.000Z"),
        },
        files: [{ assetId, expectedMimeType: "image/jpeg", expectedByteSize: 1, expectedSha256: approvedSha256 }],
      },
    },
    actor: "owner@example.com",
    requestId: "request-facebook-drive-image",
    env: {
      ...enabledEnv,
      CCPUN_GOOGLE_DRIVE_ADMIN_ROOT_FOLDER_ID: "drive_admin_root_001",
      CCPUN_GOOGLE_DRIVE_MEDIA_ROOT_FOLDER_ID: "drive_media_root_001",
    },
    dependencies: {
      sql: database.sql,
      readVariant: async () => approvedVariant({ format: "image-post", mediaMetadata: [{
        assetId, role: "primary", order: null, mimeType: "image/jpeg",
        sha256Checksum: approvedSha256, widthPx: 1200, heightPx: 1200, durationMs: null,
      }] }),
      fetchDriveBinary: async (input) => {
        driveCalls += 1;
        assert.equal(input.selectedItemId, assetId);
        assert.equal(input.accessToken, "ephemeral-drive-token");
        assert.equal(input.expectedSha256Checksum, approvedSha256);
        return { ready: true as const, file: {
          id: assetId, name: "approved.jpg", mimeType: "image/jpeg" as const, byteSize: 1,
          sha256Checksum: approvedSha256,
          body: new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array([1])); controller.close(); } }),
        } };
      },
      fetcher: async (input, init) => {
        const url = String(input);
        metaRequests.push({
          url,
          authorization: new Headers(init?.headers).get("authorization") ?? "",
          contentType: new Headers(init?.headers).get("content-type") ?? "",
        });
        if (url.includes("/me/accounts")) return new Response(JSON.stringify({ data: [{ id: "page-1", access_token: "page-secret" }] }));
        return new Response(JSON.stringify({ id: "photo-post-1" }));
      },
      now: () => new Date("2026-09-01T00:00:00.000Z"),
    },
  });
  assert.equal(result.state, "published");
  assert.equal(driveCalls, 1);
  assert.equal(metaRequests[1]!.contentType.startsWith("multipart/form-data; boundary="), true);
  assert.equal(metaRequests.some((request) => request.url.includes("ephemeral-drive-token")
    || request.authorization.includes("ephemeral-drive-token")), false);
  assert.equal(database.state.queries.some((query) => query.includes("ephemeral-drive-token")), false);
});

test("A later Drive media failure cancels already-open approved streams before Meta", async () => {
  const database = fakeSql(baseRow({ format: "album" }));
  let firstStreamCancelled = false;
  let providerCalls = 0;
  const files = ["drive_image_001", "drive_image_002"];
  await assert.rejects(executeSocialPublication({
    request: {
      publicationId: "publication:001",
      expectedJobVersion: 1,
      driveMedia: {
        accessToken: "ephemeral-drive-token",
        authorization: {
          scope: "https://www.googleapis.com/auth/drive.file",
          mode: "owner-interactive",
          tokenPersistence: "memory-only",
          refreshTokenPersistence: "forbidden",
          issuedAtMs: Date.parse("2026-09-01T00:00:00.000Z"),
          expiresAtMs: Date.parse("2026-09-01T00:30:00.000Z"),
        },
        files: files.map((assetId) => ({
          assetId,
          expectedMimeType: "image/jpeg" as const,
          expectedByteSize: 1,
          expectedSha256: approvedSha256,
        })),
      },
    },
    actor: "owner@example.com",
    requestId: "request-drive-cancel",
    env: {
      ...enabledEnv,
      CCPUN_GOOGLE_DRIVE_ADMIN_ROOT_FOLDER_ID: "drive_admin_root_001",
      CCPUN_GOOGLE_DRIVE_MEDIA_ROOT_FOLDER_ID: "drive_media_root_001",
    },
    dependencies: {
      sql: database.sql,
      readVariant: async () => approvedVariant({ format: "album", mediaMetadata: files.map((assetId, index) => ({
        assetId, role: "carousel-item" as const, order: index + 1, mimeType: "image/jpeg" as const,
        sha256Checksum: approvedSha256, widthPx: 1200, heightPx: 1200, durationMs: null,
      })) }),
      fetchDriveBinary: async ({ selectedItemId }) => selectedItemId === files[0]
        ? { ready: true as const, file: {
          id: files[0]!, name: "one.jpg", mimeType: "image/jpeg" as const, byteSize: 1,
          sha256Checksum: approvedSha256,
          body: new ReadableStream<Uint8Array>({ cancel() { firstStreamCancelled = true; } }),
        } }
        : { ready: false as const, reason: "media-metadata-mismatch" as const },
      fetcher: async () => { providerCalls += 1; return new Response(); },
      now: () => new Date("2026-09-01T00:00:00.000Z"),
    },
  }), /SOCIAL_EXECUTION_TRUSTED_MEDIA_REQUIRED/);
  assert.equal(firstStreamCancelled, true);
  assert.equal(providerCalls, 0);
});

test("A partially-started album is persisted as manual reconciliation and cannot become a rate-limit retry", async () => {
  const database = fakeSql(baseRow({ format: "album" }));
  const files = ["drive_image_001", "drive_image_002"];
  let photoCalls = 0;
  await assert.rejects(executeSocialPublication({
    request: {
      publicationId: "publication:001",
      expectedJobVersion: 1,
      driveMedia: {
        accessToken: "ephemeral-drive-token",
        authorization: {
          scope: "https://www.googleapis.com/auth/drive.file",
          mode: "owner-interactive",
          tokenPersistence: "memory-only",
          refreshTokenPersistence: "forbidden",
          issuedAtMs: Date.parse("2026-09-01T00:00:00.000Z"),
          expiresAtMs: Date.parse("2026-09-01T00:30:00.000Z"),
        },
        files: files.map((assetId) => ({ assetId, expectedMimeType: "image/jpeg" as const,
          expectedByteSize: 1, expectedSha256: approvedSha256 })),
      },
    },
    actor: "owner@example.com",
    requestId: "request-album-reconciliation",
    env: {
      ...enabledEnv,
      CCPUN_GOOGLE_DRIVE_ADMIN_ROOT_FOLDER_ID: "drive_admin_root_001",
      CCPUN_GOOGLE_DRIVE_MEDIA_ROOT_FOLDER_ID: "drive_media_root_001",
    },
    dependencies: {
      sql: database.sql,
      readVariant: async () => approvedVariant({ format: "album", mediaMetadata: files.map((assetId, index) => ({
        assetId, role: "carousel-item" as const, order: index + 1, mimeType: "image/jpeg" as const,
        sha256Checksum: approvedSha256, widthPx: 1200, heightPx: 1200, durationMs: null,
      })) }),
      fetchDriveBinary: async ({ selectedItemId }) => ({ ready: true as const, file: {
        id: String(selectedItemId), name: `${selectedItemId}.jpg`, mimeType: "image/jpeg" as const, byteSize: 1,
        sha256Checksum: approvedSha256,
        body: new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array([1])); controller.close(); } }),
      } }),
      fetcher: async (input) => {
        const url = String(input);
        if (url.includes("/me/accounts")) return new Response(JSON.stringify({ data: [{ id: "page-1", access_token: "page-secret" }] }));
        if (url.endsWith("/photos") && ++photoCalls === 1) return new Response(JSON.stringify({ id: "photo-1" }));
        return new Response(null, { status: 429 });
      },
      now: () => new Date("2026-09-01T00:00:00.000Z"),
    },
  }), /SOCIAL_EXECUTION_RECONCILIATION_REQUIRED/);
  assert.equal(database.state.row.job_status, "failed");
  assert.equal(database.state.row.last_error_category, "unknown");
  assert.equal(database.state.row.attempt_count, 1);
});

test("Approved Facebook Link Post uses its explicit HTTPS linkUrl and never parses caption", async () => {
  const database = fakeSql(baseRow({ format: "link-post" }));
  const requests: Array<{ url: string; body: URLSearchParams }> = [];
  const result = await executeSocialPublication({
    request: { publicationId: "publication:001", expectedJobVersion: 1 },
    actor: "owner@example.com",
    requestId: "request-facebook-link",
    env: enabledEnv,
    dependencies: {
      sql: database.sql,
      readVariant: async () => approvedVariant({ format: "link-post", caption: "อ่านต่อ", linkUrl: "https://ccpun.com/link" }),
      fetcher: async (input, init) => {
        requests.push({ url: String(input), body: new URLSearchParams(typeof init?.body === "string" ? init.body : "") });
        if (String(input).includes("/me/accounts")) return new Response(JSON.stringify({ data: [{ id: "page-1", access_token: "page-secret" }] }));
        return new Response(JSON.stringify({ id: "link-post-1" }));
      },
      now: () => new Date("2026-09-01T00:00:00.000Z"),
    },
  });
  assert.equal(result.state, "published");
  assert.equal(requests[1]!.body.get("link"), "https://ccpun.com/link");
  assert.equal(requests[1]!.body.get("message"), "อ่านต่อ");
});

test("Facebook Comment Series checkpoints the main post then publishes four threaded comments in exact order", async () => {
  const comments = [1, 2, 3, 4].map((position) => ({
    id: commentId(position),
    position,
    parent_item_id: position === 1 ? null : commentId(position - 1),
    status: "approved" as const,
    platform_comment_id: null,
  }));
  const database = fakeSql(baseRow(), comments);
  const providerComments: Array<{ parentObjectId: string; message: string }> = [];
  const result = await executeSocialPublication({
    request: { publicationId: "publication:001", expectedJobVersion: 1 },
    actor: "owner@example.com",
    requestId: "request-facebook-comments",
    env: enabledEnv,
    dependencies: {
      sql: database.sql,
      readVariant: async () => approvedVariant({
        caption: "สรุปสั้น",
        commentSeriesMode: "threaded",
        commentSeries: [1, 2, 3, 4].map((position) => ({ position, text: `รายละเอียด ${position}` })),
      }),
      fetcher: async (input) => String(input).includes("/me/accounts")
        ? new Response(JSON.stringify({ data: [{ id: "page-1", access_token: "page-secret" }] }))
        : new Response(JSON.stringify({ id: "main-post-1" })),
      publishComment: async (input) => {
        providerComments.push({ parentObjectId: input.parentObjectId, message: input.message });
        return { platformCommentId: `provider-comment-${providerComments.length}` };
      },
      now: () => new Date("2026-09-01T00:00:00.000Z"),
    },
  });

  assert.deepEqual(result, {
    state: "published",
    publicationId: "publication:001",
    jobId: "job:001",
    platformObjectId: "main-post-1",
    commentsPublished: 4,
  });
  assert.deepEqual(providerComments, [
    { parentObjectId: "main-post-1", message: "รายละเอียด 1" },
    { parentObjectId: "provider-comment-1", message: "รายละเอียด 2" },
    { parentObjectId: "provider-comment-2", message: "รายละเอียด 3" },
    { parentObjectId: "provider-comment-3", message: "รายละเอียด 4" },
  ]);
  assert.deepEqual(database.state.comments.map((comment) => comment.platform_comment_id), [
    "provider-comment-1", "provider-comment-2", "provider-comment-3", "provider-comment-4",
  ]);
  const mainCheckpoint = database.state.queries.findIndex((query) => query.includes("social-execution:checkpoint-main"));
  const firstComment = database.state.queries.findIndex((query) => query.includes("social-execution:comment-start"));
  assert.equal(mainCheckpoint >= 0 && firstComment > mainCheckpoint, true);
});

test("Scheduled Facebook Comment Series fails closed before any provider mutation", async () => {
  const database = fakeSql(baseRow({
    execution_target: "facebook-native-scheduled",
    publishing_mode: "native-scheduled",
    scheduled_at: "2026-09-02T01:00:00.000Z",
  }), [{ id: commentId(1), position: 1, parent_item_id: null, status: "approved", platform_comment_id: null }]);
  let providerCalls = 0;
  await assert.rejects(executeSocialPublication({
    request: { publicationId: "publication:001", expectedJobVersion: 1 },
    actor: "owner@example.com",
    requestId: "request-scheduled-comments",
    env: enabledEnv,
    dependencies: {
      sql: database.sql,
      readVariant: async () => approvedVariant({
        publishingMode: "native-scheduled",
        commentSeriesMode: "threaded",
        commentSeries: [{ position: 1, text: "ยังไม่ควรยิง" }],
      }),
      fetcher: async () => { providerCalls += 1; return new Response(); },
      now: () => new Date("2026-09-01T00:00:00.000Z"),
    },
  }), /SOCIAL_EXECUTION_SCHEDULED_COMMENTS_UNSUPPORTED/);
  assert.equal(providerCalls, 0);
  assert.equal(database.state.row.last_error_category, "conflict");
});

test("A rate-limited first comment is reset safely and retry resumes without republishing the main post", async () => {
  const database = fakeSql(baseRow(), [
    { id: commentId(1), position: 1, parent_item_id: null, status: "approved", platform_comment_id: null },
  ]);
  let mainPostCalls = 0;
  let commentCalls = 0;
  const request = { publicationId: "publication:001", expectedJobVersion: 1 };
  const common = {
    actor: "owner@example.com",
    env: enabledEnv,
    dependencies: {
      sql: database.sql,
      readVariant: async () => approvedVariant({
        commentSeriesMode: "top-level",
        commentSeries: [{ position: 1, text: "คอมเมนต์แรก" }],
      }),
      fetcher: async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("/me/accounts")) return new Response(JSON.stringify({ data: [{ id: "page-1", access_token: "page-secret" }] }));
        mainPostCalls += 1;
        return new Response(JSON.stringify({ id: "main-post-1" }));
      },
      publishComment: async () => {
        commentCalls += 1;
        if (commentCalls === 1) throw new Error("META_API_RATE_LIMITED");
        return { platformCommentId: "provider-comment-1" };
      },
      now: () => new Date("2026-09-01T00:00:00.000Z"),
    },
  };
  await assert.rejects(executeSocialPublication({ ...common, request, requestId: "request-comment-rate-limit" }), /META_API_RATE_LIMITED/);
  assert.equal(database.state.comments[0]!.status, "approved");
  assert.equal(database.state.row.platform_object_id, "main-post-1");
  assert.equal(database.state.row.last_error_category, "rate-limit");

  const result = await executeSocialPublication({
    ...common,
    request: { ...request, expectedJobVersion: database.state.row.job_version },
    requestId: "request-comment-retry",
  });
  assert.equal(result.state, "published");
  assert.equal(mainPostCalls, 1);
  assert.equal(commentCalls, 2);
  assert.equal(database.state.comments[0]!.platform_comment_id, "provider-comment-1");
});

test("Known no-mutation comment errors reset safely while every ambiguous post-start error requires reconciliation", async () => {
  for (const scenario of [
    { code: "META_API_INVALID_REQUEST", expectedCommentStatus: "approved", expectedCategory: "invalid-request", expectedError: /SOCIAL_EXECUTION_INVALID_PROVIDER_REQUEST/ },
    { code: "META_API_TIMEOUT", expectedCommentStatus: "processing", expectedCategory: "unknown", expectedError: /SOCIAL_EXECUTION_RECONCILIATION_REQUIRED/ },
    { code: "META_API_INVALID_RESPONSE", expectedCommentStatus: "processing", expectedCategory: "unknown", expectedError: /SOCIAL_EXECUTION_RECONCILIATION_REQUIRED/ },
  ] as const) {
    const database = fakeSql(baseRow({ platform_object_id: "main-post-existing" }), [
      { id: commentId(1), position: 1, parent_item_id: null, status: "approved", platform_comment_id: null },
    ]);
    await assert.rejects(executeSocialPublication({
      request: { publicationId: "publication:001", expectedJobVersion: 1 },
      actor: "owner@example.com",
      requestId: `request-comment-${scenario.code.toLowerCase()}`,
      env: enabledEnv,
      dependencies: {
        sql: database.sql,
        readVariant: async () => approvedVariant({
          commentSeriesMode: "top-level",
          commentSeries: [{ position: 1, text: "คอมเมนต์" }],
        }),
        fetcher: async () => { throw new Error("Main post must not be published again"); },
        publishComment: async () => { throw new Error(scenario.code); },
        now: () => new Date("2026-09-01T00:00:00.000Z"),
      },
    }), scenario.expectedError);
    assert.equal(database.state.comments[0]!.status, scenario.expectedCommentStatus);
    assert.equal(database.state.row.last_error_category, scenario.expectedCategory);
  }
});

test("Mocked Facebook native schedule claims once and uses the Page token returned by Meta", async () => {
  const database = fakeSql(baseRow({
    execution_target: "facebook-native-scheduled",
    publishing_mode: "native-scheduled",
    scheduled_at: "2026-09-02T01:00:00.000Z",
  }));
  const providerRequests: Array<{ url: string; authorization: string; body: URLSearchParams }> = [];
  const result = await executeSocialPublication({
    request: { publicationId: "publication:001", expectedJobVersion: 1 },
    actor: "owner@example.com",
    requestId: "request-facebook-schedule",
    env: enabledEnv,
    dependencies: {
      sql: database.sql,
      readVariant: async () => approvedVariant({ publishingMode: "native-scheduled" }),
      now: () => new Date("2026-09-01T00:00:00.000Z"),
      fetcher: async (input, init) => {
        const url = String(input);
        providerRequests.push({
          url,
          authorization: new Headers(init?.headers).get("authorization") ?? "",
          body: new URLSearchParams(typeof init?.body === "string" ? init.body : ""),
        });
        if (url.includes("/me/accounts")) return new Response(JSON.stringify({ data: [
          { id: "page-1", access_token: "page-secret" },
        ] }));
        return new Response(JSON.stringify({ id: "scheduled-post-1" }));
      },
    },
  });
  assert.deepEqual(result, {
    state: "scheduled",
    publicationId: "publication:001",
    jobId: "job:001",
    platformObjectId: "scheduled-post-1",
  });
  assert.deepEqual(providerRequests.map((request) => request.authorization), ["Bearer meta-secret", "Bearer page-secret"]);
  assert.equal(providerRequests.every((request) => !request.url.includes("secret")), true);
  assert.equal(providerRequests[1]!.body.get("published"), "false");
  assert.equal(providerRequests[1]!.body.get("scheduled_publish_time"), "1788310800");
  assert.equal(database.state.row.job_status, "succeeded");
  assert.equal(database.state.row.publication_status, "native-scheduled");
});

test("Manual execution route is owner-only, same-origin, UAT-gated and has no background runner", () => {
  const route = read("app/api/admin/social/publications/execute/route.ts");
  const store = read("lib/admin/social/execution-store.ts");
  assert.match(route, /identity\.actorType !== "human" \|\| identity\.role !== "owner"/);
  assert.match(route, /isSameOriginAdminMutation\(request\.url, request\.headers\.get\("origin"\)\)/);
  assert.match(route, /isSocialProviderExecutionEnabled\(\)/);
  assert.match(route, /socialPublicationExecuteRequestSchema\.safeParse/);
  assert.match(store, /isSocialProviderExecutionGateEnabled\(env\)/);
  assert.match(store, /version=version\+1/);
  assert.match(store, /attempt_count<max_attempts/);
  assert.match(store, /FOR UPDATE/);
  assert.doesNotMatch(`${route}\n${store}`, /setInterval|cron|n8n/i);
});
