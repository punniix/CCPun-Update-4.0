import assert from "node:assert/strict";
import test from "node:test";
import { SYNTHETIC_GOOGLE_DRIVE_FILE_ID, SYNTHETIC_GOOGLE_DRIVE_ITEMS, SYNTHETIC_GOOGLE_DRIVE_ROOT_FOLDER_ID } from "./google-drive-fixtures";
import {
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
const sha256 = "a".repeat(64);

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
  assert.equal(oversized.ready, true);
  if (!oversized.ready) assert.fail("The body limit must be enforced while consuming the stream");
  await assert.rejects(() => new Response(oversized.file.body).arrayBuffer(), /GOOGLE_DRIVE_MEDIA_SIZE_MISMATCH/);
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
