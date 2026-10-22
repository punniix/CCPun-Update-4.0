import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { SYNTHETIC_GOOGLE_DRIVE_FILE_ID, SYNTHETIC_GOOGLE_DRIVE_ITEMS, SYNTHETIC_GOOGLE_DRIVE_ROOT_FOLDER_ID } from "./google-drive-fixtures";
import {
  canStageGoogleDriveMedia,
  disposeGoogleDriveSelectedFileBinary,
  MAX_GOOGLE_DRIVE_STAGED_BYTES,
  GOOGLE_DRIVE_STAGING_RESERVE_BYTES,
  fetchGoogleDriveSelectedFileBinary,
  GOOGLE_DRIVE_FILE_SCOPE,
  GOOGLE_DRIVE_FOLDER_MIME_TYPE,
  MAX_GOOGLE_DRIVE_BINARY_BYTES,
} from "../../lib/admin/media/google-drive-foundation";

const authorization = {
  scope: GOOGLE_DRIVE_FILE_SCOPE,
  mode: "owner-interactive",
  tokenPersistence: "memory-only",
  refreshTokenPersistence: "forbidden",
  issuedAtMs: 1_000,
  expiresAtMs: 3_601_000,
} as const;
const sha256 = createHash("sha256").update(new Uint8Array([1, 2, 3, 4])).digest("hex");

function driveItem(id: string, size = 4) {
  const item = SYNTHETIC_GOOGLE_DRIVE_ITEMS.find((candidate) => candidate.id === id);
  if (!item) return null;
  return {
    ...item,
    ...(id === SYNTHETIC_GOOGLE_DRIVE_FILE_ID
      ? { name: "approved.mp4", modifiedTime: "2026-09-01T01:00:00.000Z", size: String(size), sha256Checksum: sha256 }
      : {}),
  };
}

test("manual Drive binary bridge revalidates ancestry then opens one exact bounded media stream", async () => {
  const requests: Array<{ url: URL; authorization: string | null; accept: string | null; method: string }> = [];
  const result = await fetchGoogleDriveSelectedFileBinary({
    rootFolderIds: [SYNTHETIC_GOOGLE_DRIVE_ROOT_FOLDER_ID],
    selectedItemId: SYNTHETIC_GOOGLE_DRIVE_FILE_ID,
    accessToken: "synthetic-memory-only-token",
    authorization,
    nowMs: 2_000,
    expectedMimeType: "video/mp4",
    expectedByteSize: 4,
    expectedSha256Checksum: sha256,
    fetchImpl: async (input, init) => {
      const url = new URL(String(input));
      const headers = new Headers(init?.headers);
      requests.push({
        url,
        authorization: headers.get("authorization"),
        accept: headers.get("accept"),
        method: init?.method ?? "GET",
      });
      const id = decodeURIComponent(url.pathname.split("/").at(-1)!);
      if (url.searchParams.get("alt") === "media") {
        return new Response(new Uint8Array([1, 2, 3, 4]), {
          headers: { "Content-Type": "video/mp4", "Content-Length": "4" },
        });
      }
      return new Response(JSON.stringify(driveItem(id)), { status: 200 });
    },
  });

  assert.equal(result.ready, true);
  if (!result.ready) assert.fail("Approved Drive media must be ready");
  assert.equal(result.file.mimeType, "video/mp4");
  assert.equal(result.file.byteSize, 4);
  assert.equal(result.file.sha256Checksum, sha256);
  assert.deepEqual([...new Uint8Array(await new Response(result.file.body).arrayBuffer())], [1, 2, 3, 4]);
  assert.equal(requests.length, 4);
  assert.equal(requests.every((request) => request.url.origin === "https://www.googleapis.com"), true);
  assert.equal(requests.every((request) => request.authorization === "Bearer synthetic-memory-only-token"), true);
  assert.equal(requests.at(-1)?.url.searchParams.get("alt"), "media");
  assert.equal(requests.at(-1)?.accept, "video/mp4");
  assert.equal(requests.at(-1)?.method, "GET");
  assert.equal(JSON.stringify(result).includes("synthetic-memory-only-token"), false);
});

test("manual Drive binary bridge rejects mismatched metadata and invalid header tokens before download", async () => {
  let mediaRequests = 0;
  const fetchImpl = async (input: URL | RequestInfo) => {
    const url = new URL(String(input));
    if (url.searchParams.get("alt") === "media") mediaRequests += 1;
    const id = decodeURIComponent(url.pathname.split("/").at(-1)!);
    return new Response(JSON.stringify(driveItem(id, 5)), { status: 200 });
  };
  const base = {
    rootFolderIds: [SYNTHETIC_GOOGLE_DRIVE_ROOT_FOLDER_ID],
    selectedItemId: SYNTHETIC_GOOGLE_DRIVE_FILE_ID,
    authorization,
    nowMs: 2_000,
    expectedMimeType: "video/mp4",
    expectedByteSize: 4,
    expectedSha256Checksum: sha256,
    fetchImpl,
  } as const;

  assert.deepEqual(await fetchGoogleDriveSelectedFileBinary({ ...base, accessToken: "synthetic-memory-only-token" }), {
    ready: false,
    reason: "media-metadata-mismatch",
  });
  assert.deepEqual(await fetchGoogleDriveSelectedFileBinary({ ...base, accessToken: "bad\nheader" }), {
    ready: false,
    reason: "invalid-boundary-input",
  });
  assert.deepEqual(await fetchGoogleDriveSelectedFileBinary({
    ...base,
    accessToken: "synthetic-memory-only-token",
    expectedByteSize: MAX_GOOGLE_DRIVE_BINARY_BYTES + 1,
  }), { ready: false, reason: "invalid-boundary-input" });
  assert.deepEqual(await fetchGoogleDriveSelectedFileBinary({
    ...base,
    accessToken: "synthetic-memory-only-token",
    expectedSha256Checksum: "b".repeat(64),
  }), { ready: false, reason: "media-metadata-mismatch" });
  assert.equal(mediaRequests, 0);
});

test("manual Drive binary bridge validates response MIME, declared size and streamed size", async () => {
  const run = (response: Response) => fetchGoogleDriveSelectedFileBinary({
    rootFolderIds: [SYNTHETIC_GOOGLE_DRIVE_ROOT_FOLDER_ID],
    selectedItemId: SYNTHETIC_GOOGLE_DRIVE_FILE_ID,
    accessToken: "synthetic-memory-only-token",
    authorization,
    nowMs: 2_000,
    expectedMimeType: "video/mp4",
    expectedByteSize: 4,
    expectedSha256Checksum: sha256,
    fetchImpl: async (input) => {
      const url = new URL(String(input));
      if (url.searchParams.get("alt") === "media") return response;
      const id = decodeURIComponent(url.pathname.split("/").at(-1)!);
      return new Response(JSON.stringify(driveItem(id)), { status: 200 });
    },
  });

  assert.deepEqual(await run(new Response(new Uint8Array(4), {
    headers: { "Content-Type": "image/png", "Content-Length": "4" },
  })), { ready: false, reason: "media-response-unverifiable" });
  assert.deepEqual(await run(new Response(new Uint8Array(4), {
    headers: { "Content-Type": "video/mp4", "Content-Length": "5" },
  })), { ready: false, reason: "media-response-unverifiable" });

  const oversized = await run(new Response(new Uint8Array(5), {
    headers: { "Content-Type": "video/mp4" },
  }));
  assert.deepEqual(oversized, { ready: false, reason: "media-response-unverifiable" }, "no provider can receive a stream before exact size verification");
});

test("manual Drive binary bridge denies a selected folder before requesting bytes", async () => {
  let mediaRequests = 0;
  const result = await fetchGoogleDriveSelectedFileBinary({
    rootFolderIds: [SYNTHETIC_GOOGLE_DRIVE_ROOT_FOLDER_ID],
    selectedItemId: SYNTHETIC_GOOGLE_DRIVE_ROOT_FOLDER_ID,
    accessToken: "synthetic-memory-only-token",
    authorization,
    nowMs: 2_000,
    expectedMimeType: "video/mp4",
    expectedByteSize: 4,
    expectedSha256Checksum: sha256,
    fetchImpl: async (input) => {
      const url = new URL(String(input));
      if (url.searchParams.get("alt") === "media") mediaRequests += 1;
      const id = decodeURIComponent(url.pathname.split("/").at(-1)!);
      const item = driveItem(id);
      return new Response(JSON.stringify(item && { ...item, mimeType: GOOGLE_DRIVE_FOLDER_MIME_TYPE }), { status: 200 });
    },
  });
  assert.deepEqual(result, { ready: false, reason: "selected-item-is-folder" });
  assert.equal(mediaRequests, 0);
});

function download(response: Response, signal?: AbortSignal) {
  return fetchGoogleDriveSelectedFileBinary({
    rootFolderIds: [SYNTHETIC_GOOGLE_DRIVE_ROOT_FOLDER_ID], selectedItemId: SYNTHETIC_GOOGLE_DRIVE_FILE_ID,
    accessToken: "synthetic-memory-only-token", authorization, nowMs: 2_000,
    expectedMimeType: "video/mp4", expectedByteSize: 4, expectedSha256Checksum: sha256, signal,
    fetchImpl: async input => {
      const url = new URL(String(input));
      return url.searchParams.get("alt") === "media" ? response
        : new Response(JSON.stringify(driveItem(decodeURIComponent(url.pathname.split("/").at(-1)!))));
    },
  });
}

test("same-size changed bytes, truncated data and body failures never become approved media", async () => {
  for (const bytes of [[1, 2, 3, 5], [1, 2, 3], []]) {
    assert.deepEqual(await download(new Response(new Uint8Array(bytes), { headers: { "Content-Type": "video/mp4" } })),
      { ready: false, reason: "media-response-unverifiable" });
  }
  const failed = new ReadableStream<Uint8Array>({ pull(controller) { controller.error(new Error("synthetic-provider-payload")); } });
  assert.deepEqual(await download(new Response(failed, { headers: { "Content-Type": "video/mp4" } })),
    { ready: false, reason: "media-response-unverifiable" });
});

test("verified private staging disposes locked streams idempotently and leaves no named media", async () => {
  const names = async () => (await readdir(tmpdir())).filter(name => name.startsWith("ccpun-approved-media-"));
  const before = await names();
  const result = await download(new Response(new Uint8Array([1, 2, 3, 4]), { headers: { "Content-Type": "video/mp4" } }));
  assert.equal(result.ready, true);
  if (!result.ready) assert.fail("verified bytes must be ready");
  assert.deepEqual(await names(), before, "pathname is already unlinked before stream is exposed");
  const reader = result.file.body.getReader();
  await disposeGoogleDriveSelectedFileBinary(result.file.body);
  await disposeGoogleDriveSelectedFileBinary(result.file.body);
  await assert.rejects(reader.read(), /GOOGLE_DRIVE_MEDIA_CLOSED/);
  reader.releaseLock();
  assert.deepEqual(await names(), before);
});

test("aborted pending download cancels bytes before approval and cleans its private staging", async () => {
  const controller = new AbortController();
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({ cancel() { cancelled = true; } });
  const pending = download(new Response(body, { headers: { "Content-Type": "video/mp4" } }), controller.signal);
  setTimeout(() => controller.abort(), 20);
  assert.deepEqual(await pending, { ready: false, reason: "media-response-unverifiable" });
  assert.equal(cancelled, true);
});

test("media resource admission retains 1GB/file and ten-file aggregate with explicit disk reserve", () => {
  const available = MAX_GOOGLE_DRIVE_STAGED_BYTES + GOOGLE_DRIVE_STAGING_RESERVE_BYTES;
  assert.equal(canStageGoogleDriveMedia(MAX_GOOGLE_DRIVE_BINARY_BYTES, 9 * MAX_GOOGLE_DRIVE_BINARY_BYTES, 9 * MAX_GOOGLE_DRIVE_BINARY_BYTES, available), true);
  assert.equal(canStageGoogleDriveMedia(MAX_GOOGLE_DRIVE_BINARY_BYTES, MAX_GOOGLE_DRIVE_STAGED_BYTES, 0, available), false);
  assert.equal(canStageGoogleDriveMedia(MAX_GOOGLE_DRIVE_BINARY_BYTES + 1, 0, 0, available), false);
  assert.equal(canStageGoogleDriveMedia(4, 0, 0, GOOGLE_DRIVE_STAGING_RESERVE_BYTES + 3), false);
  assert.equal(canStageGoogleDriveMedia(4, 0, 0, GOOGLE_DRIVE_STAGING_RESERVE_BYTES + 4), true);
  assert.equal(canStageGoogleDriveMedia(4, 0, 10, GOOGLE_DRIVE_STAGING_RESERVE_BYTES + 4), false);
});
