import assert from "node:assert/strict";
import test from "node:test";
import { SYNTHETIC_GOOGLE_DRIVE_FILE_ID, SYNTHETIC_GOOGLE_DRIVE_ITEMS, SYNTHETIC_GOOGLE_DRIVE_ROOT_FOLDER_ID } from "./google-drive-fixtures";
import {
  evaluateGoogleDriveInteractiveAuthorization,
  fetchGoogleDriveBoundaryEvidence,
  fetchGoogleDriveSelectedFileProjection,
  evaluateGoogleDriveRootBoundary,
  GOOGLE_DRIVE_FILE_SCOPE,
  GOOGLE_DRIVE_FOLDER_MIME_TYPE,
  GOOGLE_DRIVE_SHORTCUT_MIME_TYPE,
  googleDriveInteractiveAuthorizationSchema,
  googleDriveSelectedFileRequestSchema,
  parseGoogleDriveApprovedRootFolderIds,
  validateGoogleDriveProjectionHttpRequest,
  type GoogleDriveNormalizedItem,
} from "../../lib/admin/media/google-drive-foundation";

const validAuthorization = {
  scope: GOOGLE_DRIVE_FILE_SCOPE,
  mode: "owner-interactive",
  tokenPersistence: "memory-only",
  refreshTokenPersistence: "forbidden",
  issuedAtMs: 1_000,
  expiresAtMs: 3_601_000,
} as const;

const evaluate = (items: readonly GoogleDriveNormalizedItem[] = SYNTHETIC_GOOGLE_DRIVE_ITEMS, rootFolderId = SYNTHETIC_GOOGLE_DRIVE_ROOT_FOLDER_ID) =>
  evaluateGoogleDriveRootBoundary({
    rootFolderId,
    selectedItemId: SYNTHETIC_GOOGLE_DRIVE_FILE_ID,
    items,
  });

test("Drive foundation permits only drive.file and short-lived memory-only interactive authorization", () => {
  assert.equal(GOOGLE_DRIVE_FILE_SCOPE, "https://www.googleapis.com/auth/drive.file");
  assert.deepEqual(evaluateGoogleDriveInteractiveAuthorization(validAuthorization, 2_000), {
    usable: true,
    reason: "interactive-authorization-ready",
  });
  assert.deepEqual(evaluateGoogleDriveInteractiveAuthorization({ ...validAuthorization, scope: "https://www.googleapis.com/auth/drive.readonly" }, 2_000), {
    usable: false,
    reason: "invalid-authorization",
  });
  assert.deepEqual(evaluateGoogleDriveInteractiveAuthorization({ ...validAuthorization, expiresAtMs: 3_601_001 }, 2_000), {
    usable: false,
    reason: "invalid-authorization",
  });
  assert.deepEqual(evaluateGoogleDriveInteractiveAuthorization(validAuthorization, 3_601_000), {
    usable: false,
    reason: "expired",
  });
  for (const invalidNow of [Number.NaN, Number.POSITIVE_INFINITY, -1, 1.5]) {
    assert.deepEqual(evaluateGoogleDriveInteractiveAuthorization(validAuthorization, invalidNow), {
      usable: false,
      reason: "invalid-authorization",
    });
  }
  assert.equal(googleDriveInteractiveAuthorizationSchema.safeParse({ ...validAuthorization, accessToken: "synthetic-not-allowed" }).success, false);
  assert.equal(googleDriveInteractiveAuthorizationSchema.safeParse({ ...validAuthorization, refreshToken: "synthetic-not-allowed" }).success, false);
});

test("Drive ancestry authorizes a file only through the exact immutable root folder ID", () => {
  assert.deepEqual(evaluate(), {
    allowed: true,
    reason: "inside-configured-root",
    provenance: {
      source: "google-drive",
      fileId: SYNTHETIC_GOOGLE_DRIVE_FILE_ID,
      rootFolderId: SYNTHETIC_GOOGLE_DRIVE_ROOT_FOLDER_ID,
      authorizationScope: GOOGLE_DRIVE_FILE_SCOPE,
    },
  });
  assert.deepEqual(evaluate(SYNTHETIC_GOOGLE_DRIVE_ITEMS, "synthetic_other_root_20260828"), {
    allowed: false,
    reason: "ancestry-unverifiable",
  });
});

test("Drive ancestry fails closed for moved, trashed, shortcut, missing and cyclic items", () => {
  const replace = (id: string, patch: Partial<GoogleDriveNormalizedItem>) =>
    SYNTHETIC_GOOGLE_DRIVE_ITEMS.map((item) => item.id === id ? { ...item, ...patch } : item);

  const movedItems: GoogleDriveNormalizedItem[] = [
    ...replace(SYNTHETIC_GOOGLE_DRIVE_FILE_ID, { parents: ["synthetic_outside_folder_20260828"] }),
    {
      id: "synthetic_outside_folder_20260828",
      mimeType: GOOGLE_DRIVE_FOLDER_MIME_TYPE,
      parents: [],
      trashed: false,
      shortcutDetails: null,
    },
  ];
  assert.deepEqual(evaluate(movedItems), { allowed: false, reason: "outside-configured-root" });
  assert.deepEqual(evaluate(replace(SYNTHETIC_GOOGLE_DRIVE_FILE_ID, { trashed: true })), {
    allowed: false,
    reason: "trashed-item-denied",
  });
  assert.deepEqual(evaluate(replace("synthetic_ccpun_media_folder_20260828", { trashed: true })), {
    allowed: false,
    reason: "trashed-item-denied",
  });
  assert.deepEqual(evaluate(replace(SYNTHETIC_GOOGLE_DRIVE_FILE_ID, {
    mimeType: GOOGLE_DRIVE_SHORTCUT_MIME_TYPE,
    shortcutDetails: {
      targetId: "synthetic_shortcut_target_20260828",
      targetMimeType: "video/mp4",
    },
  })), { allowed: false, reason: "shortcut-denied" });
  assert.deepEqual(evaluate(SYNTHETIC_GOOGLE_DRIVE_ITEMS.filter((item) => item.id !== "synthetic_ccpun_media_folder_20260828")), {
    allowed: false,
    reason: "ancestry-unverifiable",
  });
  assert.deepEqual(evaluate(replace("synthetic_ccpun_media_folder_20260828", { parents: [SYNTHETIC_GOOGLE_DRIVE_FILE_ID] })), {
    allowed: false,
    reason: "ancestry-unverifiable",
  });
});

test("Drive ancestry rejects unverifiable metadata and a non-folder configured root", () => {
  const replace = (id: string, patch: Partial<GoogleDriveNormalizedItem>) =>
    SYNTHETIC_GOOGLE_DRIVE_ITEMS.map((item) => item.id === id ? { ...item, ...patch } : item);

  assert.deepEqual(evaluate(replace(SYNTHETIC_GOOGLE_DRIVE_FILE_ID, { parents: null })), {
    allowed: false,
    reason: "ancestry-unverifiable",
  });
  assert.deepEqual(evaluate(replace(SYNTHETIC_GOOGLE_DRIVE_FILE_ID, { trashed: null })), {
    allowed: false,
    reason: "ancestry-unverifiable",
  });
  assert.deepEqual(evaluate(replace(SYNTHETIC_GOOGLE_DRIVE_ROOT_FOLDER_ID, { mimeType: "application/octet-stream" })), {
    allowed: false,
    reason: "root-is-not-folder",
  });
  assert.deepEqual(evaluate([...SYNTHETIC_GOOGLE_DRIVE_ITEMS, SYNTHETIC_GOOGLE_DRIVE_ITEMS[0]]), {
    allowed: false,
    reason: "ancestry-unverifiable",
  });
});

test("Synthetic Drive contract contains IDs and metadata only", () => {
  const serialized = JSON.stringify({ validAuthorization, items: SYNTHETIC_GOOGLE_DRIVE_ITEMS });
  assert.equal(/"(?:accessToken|refreshToken|clientSecret|signedUrl|downloadUrl)"\s*:/i.test(serialized), false);
  assert.equal(serialized.includes("Google Drive / CCPun"), false);
});

test("Drive adapter fetches current ancestry and never returns the access token", async () => {
  const items = new Map(SYNTHETIC_GOOGLE_DRIVE_ITEMS.map((item) => [item.id, item]));
  const seen: Array<{ url: string; authorization: string | null }> = [];
  const result = await fetchGoogleDriveBoundaryEvidence({
    rootFolderId: SYNTHETIC_GOOGLE_DRIVE_ROOT_FOLDER_ID,
    selectedItemId: SYNTHETIC_GOOGLE_DRIVE_FILE_ID,
    accessToken: "synthetic-memory-only-token",
    fetchImpl: async (input, init) => {
      const url = new URL(String(input));
      const id = decodeURIComponent(url.pathname.split("/").at(-1)!);
      seen.push({ url: url.toString(), authorization: new Headers(init?.headers).get("authorization") });
      const item = items.get(id);
      return new Response(item ? JSON.stringify(item) : null, { status: item ? 200 : 404 });
    },
  });
  assert.equal(result.allowed, true);
  assert.equal(seen.length, 3);
  assert.equal(seen.every((request) => request.authorization === "Bearer synthetic-memory-only-token"), true);
  assert.equal(JSON.stringify(result).includes("synthetic-memory-only-token"), false);
});

test("Drive selected-file request accepts one ephemeral token and rejects extra or broad authorization", () => {
  const request = {
    selectedFileId: SYNTHETIC_GOOGLE_DRIVE_FILE_ID,
    accessToken: "synthetic-memory-only-token",
    authorization: validAuthorization,
  };
  assert.equal(googleDriveSelectedFileRequestSchema.safeParse(request).success, true);
  assert.equal(googleDriveSelectedFileRequestSchema.safeParse({ ...request, selectedFileIds: [SYNTHETIC_GOOGLE_DRIVE_FILE_ID] }).success, false);
  assert.equal(googleDriveSelectedFileRequestSchema.safeParse({ ...request, refreshToken: "forbidden" }).success, false);
  assert.equal(googleDriveSelectedFileRequestSchema.safeParse({
    ...request,
    authorization: { ...validAuthorization, scope: "https://www.googleapis.com/auth/drive.readonly" },
  }).success, false);

  const body = JSON.stringify(request);
  assert.deepEqual(validateGoogleDriveProjectionHttpRequest({
    contentType: "application/json; charset=utf-8",
    contentLength: String(Buffer.byteLength(body, "utf8")),
    body,
  }), { ok: true, data: request });
  const unsupportedMediaType = validateGoogleDriveProjectionHttpRequest({
    contentType: "multipart/form-data",
    contentLength: String(Buffer.byteLength(body, "utf8")),
    body,
  });
  assert.equal(unsupportedMediaType.ok, false);
  if (unsupportedMediaType.ok) assert.fail("Multipart Drive projection input must be rejected");
  assert.equal(unsupportedMediaType.status, 415);

  const missingLength = validateGoogleDriveProjectionHttpRequest({
    contentType: "application/json",
    contentLength: null,
    body,
  });
  assert.equal(missingLength.ok, false);
  if (missingLength.ok) assert.fail("Drive projection input without Content-Length must be rejected");
  assert.equal(missingLength.status, 413);
});

test("configured Drive roots fail closed when absent, duplicated or malformed", () => {
  const adminRoot = "synthetic_admin_control_root_20260830";
  assert.deepEqual(parseGoogleDriveApprovedRootFolderIds([adminRoot, SYNTHETIC_GOOGLE_DRIVE_ROOT_FOLDER_ID]), [
    adminRoot,
    SYNTHETIC_GOOGLE_DRIVE_ROOT_FOLDER_ID,
  ]);
  assert.equal(parseGoogleDriveApprovedRootFolderIds([undefined, ""]), null);
  assert.equal(parseGoogleDriveApprovedRootFolderIds([adminRoot, adminRoot]), null);
  assert.equal(parseGoogleDriveApprovedRootFolderIds([adminRoot, "not valid"]), null);
});

test("selected-file projection verifies either approved root and returns only safe display fields", async () => {
  const adminRoot = "synthetic_admin_control_root_20260830";
  const enrichedItems = new Map(SYNTHETIC_GOOGLE_DRIVE_ITEMS.map((item) => [item.id, {
    ...item,
    ...(item.id === SYNTHETIC_GOOGLE_DRIVE_FILE_ID ? {
      name: "approved-media.mp4",
      modifiedTime: "2026-08-30T02:00:00.000Z",
      sha256Checksum: "a".repeat(64),
      webViewLink: "https://drive.google.com/file/d/synthetic/view",
      thumbnailLink: "https://lh3.googleusercontent.com/synthetic-thumbnail",
      iconLink: "https://drive-thirdparty.googleusercontent.com/16/type/video/mp4",
      owners: [{ emailAddress: "must-not-project@example.invalid" }],
      permissions: [{ id: "must-not-project" }],
      body: "must-not-project",
    } : {}),
  }]));
  const seenFields: string[] = [];
  const result = await fetchGoogleDriveSelectedFileProjection({
    rootFolderIds: [adminRoot, SYNTHETIC_GOOGLE_DRIVE_ROOT_FOLDER_ID],
    selectedItemId: SYNTHETIC_GOOGLE_DRIVE_FILE_ID,
    accessToken: "synthetic-memory-only-token",
    authorization: validAuthorization,
    nowMs: 2_000,
    fetchImpl: async (input) => {
      const url = new URL(String(input));
      const id = decodeURIComponent(url.pathname.split("/").at(-1)!);
      seenFields.push(url.searchParams.get("fields") ?? "");
      const item = enrichedItems.get(id);
      return new Response(item ? JSON.stringify(item) : null, { status: item ? 200 : 404 });
    },
  });

  assert.deepEqual(result, {
    projected: true,
    item: {
      id: SYNTHETIC_GOOGLE_DRIVE_FILE_ID,
      name: "approved-media.mp4",
      mimeType: "video/mp4",
      modifiedTime: "2026-08-30T02:00:00.000Z",
      sha256Checksum: "a".repeat(64),
      webViewLink: "https://drive.google.com/file/d/synthetic/view",
      thumbnailLink: "https://lh3.googleusercontent.com/synthetic-thumbnail",
      iconLink: "https://drive-thirdparty.googleusercontent.com/16/type/video/mp4",
    },
  });
  assert.equal(seenFields.length, 3);
  assert.equal(seenFields.every((fields) => fields.includes("sha256Checksum")
    && fields.includes("webViewLink") && fields.includes("thumbnailLink") && fields.includes("iconLink")), true);
  assert.equal(seenFields.every((fields) => !/(?:permissions|owners|emailAddress|download)/i.test(fields)), true);
  const serialized = JSON.stringify(result);
  assert.equal(/accessToken|refreshToken|owners|permissions|emailAddress|body/i.test(serialized), false);
});

test("selected-file projection denies wrong roots, expired authorization and folders without provider writes", async () => {
  let fetchCount = 0;
  const fetchImpl = async (input: URL | RequestInfo) => {
    fetchCount += 1;
    const url = new URL(String(input));
    const id = decodeURIComponent(url.pathname.split("/").at(-1)!);
    const item = SYNTHETIC_GOOGLE_DRIVE_ITEMS.find((candidate) => candidate.id === id);
    return new Response(item ? JSON.stringify(item) : null, { status: item ? 200 : 404 });
  };

  const expired = await fetchGoogleDriveSelectedFileProjection({
    rootFolderIds: [SYNTHETIC_GOOGLE_DRIVE_ROOT_FOLDER_ID],
    selectedItemId: SYNTHETIC_GOOGLE_DRIVE_FILE_ID,
    accessToken: "synthetic-memory-only-token",
    authorization: validAuthorization,
    nowMs: validAuthorization.expiresAtMs,
    fetchImpl,
  });
  assert.deepEqual(expired, { projected: false, reason: "expired" });
  assert.equal(fetchCount, 0);

  const wrongRoot = await fetchGoogleDriveSelectedFileProjection({
    rootFolderIds: ["synthetic_wrong_approved_root_20260830"],
    selectedItemId: SYNTHETIC_GOOGLE_DRIVE_FILE_ID,
    accessToken: "synthetic-memory-only-token",
    authorization: validAuthorization,
    nowMs: 2_000,
    fetchImpl,
  });
  assert.equal(wrongRoot.projected, false);
  if (wrongRoot.projected) assert.fail("A file outside the configured roots must be denied");
  assert.equal(["selected-file-denied", "provider-unavailable"].includes(wrongRoot.reason), true);

  const folder = await fetchGoogleDriveSelectedFileProjection({
    rootFolderIds: [SYNTHETIC_GOOGLE_DRIVE_ROOT_FOLDER_ID],
    selectedItemId: SYNTHETIC_GOOGLE_DRIVE_ROOT_FOLDER_ID,
    accessToken: "synthetic-memory-only-token",
    authorization: validAuthorization,
    nowMs: 2_000,
    fetchImpl,
  });
  assert.deepEqual(folder, { projected: false, reason: "selected-item-is-folder" });
});
