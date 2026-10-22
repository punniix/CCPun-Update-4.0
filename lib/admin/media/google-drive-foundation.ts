import { createHash } from "node:crypto";
import { chmod, mkdtemp, open, rm, rmdir, statfs, unlink, type FileHandle } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

if (typeof window !== "undefined") {
  throw new Error("GOOGLE_DRIVE_MEDIA_BOUNDARY_SERVER_ONLY");
}

export const GOOGLE_DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file" as const;
export const GOOGLE_DRIVE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder" as const;
export const GOOGLE_DRIVE_SHORTCUT_MIME_TYPE = "application/vnd.google-apps.shortcut" as const;
export const GOOGLE_DRIVE_INTERACTIVE_AUTH_MAX_TTL_MS = 60 * 60 * 1_000;
export const MAX_GOOGLE_DRIVE_PROJECTION_BODY_BYTES = 12_288;
export const MAX_GOOGLE_DRIVE_BINARY_BYTES = 1_000_000_000;
const GOOGLE_DRIVE_API_ORIGIN = "https://www.googleapis.com";
const googleDriveDownloadMimeTypeSchema = z.enum([
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
]);
const googleDriveSha256ChecksumSchema = z.string().regex(/^[0-9a-f]{64}$/);

export const googleDriveFileIdSchema = z.string()
  .trim()
  .min(10)
  .max(200)
  .regex(/^[A-Za-z0-9_-]+$/);

export const googleDriveRootBoundarySchema = z.strictObject({
  rootFolderId: googleDriveFileIdSchema,
  authorizationBasis: z.literal("exact-immutable-folder-id"),
});

export const googleDriveInteractiveAuthorizationSchema = z.strictObject({
  scope: z.literal(GOOGLE_DRIVE_FILE_SCOPE),
  mode: z.literal("owner-interactive"),
  tokenPersistence: z.literal("memory-only"),
  refreshTokenPersistence: z.literal("forbidden"),
  issuedAtMs: z.number().int().nonnegative(),
  expiresAtMs: z.number().int().positive(),
}).superRefine((authorization, context) => {
  const ttlMs = authorization.expiresAtMs - authorization.issuedAtMs;
  if (ttlMs <= 0 || ttlMs > GOOGLE_DRIVE_INTERACTIVE_AUTH_MAX_TTL_MS) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Interactive authorization must be short-lived",
    });
  }
});

export type GoogleDriveInteractiveAuthorization = z.infer<typeof googleDriveInteractiveAuthorizationSchema>;

const googleDriveAccessTokenSchema = z.string()
  .trim()
  .min(1)
  .max(8_192)
  .regex(/^[\x21-\x7E]+$/, "Drive access token must be a single printable header value");

export const googleDriveSelectedFileRequestSchema = z.strictObject({
  selectedFileId: googleDriveFileIdSchema,
  accessToken: googleDriveAccessTokenSchema,
  authorization: googleDriveInteractiveAuthorizationSchema,
});

export type GoogleDriveSelectedFileRequest = z.infer<typeof googleDriveSelectedFileRequestSchema>;

const googleDriveHttpsUrlSchema = z.string()
  .trim()
  .max(4_096)
  .url()
  .refine((value) => {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  });

export const googleDriveSelectedFileProjectionSchema = z.strictObject({
  id: googleDriveFileIdSchema,
  name: z.string().trim().min(1).max(255).refine(
    (value) => !/[\u0000-\u001F\u007F-\u009F]/u.test(value),
    "Drive name must not contain a control character",
  ),
  mimeType: z.string().trim().min(1).max(200),
  modifiedTime: z.iso.datetime({ offset: true }),
  sha256Checksum: googleDriveSha256ChecksumSchema,
  webViewLink: googleDriveHttpsUrlSchema.nullable(),
  thumbnailLink: googleDriveHttpsUrlSchema.nullable(),
  iconLink: googleDriveHttpsUrlSchema.nullable(),
});

export type GoogleDriveSelectedFileProjection = z.infer<typeof googleDriveSelectedFileProjectionSchema>;

const googleDriveApprovedRootFolderIdsSchema = z.array(googleDriveFileIdSchema)
  .min(1)
  .max(2)
  .superRefine((ids, context) => {
    if (new Set(ids).size !== ids.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Drive roots must be unique" });
    }
  });

export function parseGoogleDriveApprovedRootFolderIds(values: readonly unknown[]): string[] | null {
  const parsed = googleDriveApprovedRootFolderIdsSchema.safeParse(
    values.filter((value) => typeof value !== "string" || value.trim().length > 0),
  );
  return parsed.success ? parsed.data : null;
}

export type GoogleDriveProjectionHttpValidation =
  | { ok: true; data: GoogleDriveSelectedFileRequest }
  | { ok: false; error: "unsupported-media-type" | "payload-too-large" | "invalid-input"; status: 400 | 413 | 415 };

export function validateGoogleDriveProjectionHttpRequest(input: {
  contentType: string | null;
  contentLength: string | null;
  body: string;
}): GoogleDriveProjectionHttpValidation {
  const contentType = input.contentType?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    return { ok: false, error: "unsupported-media-type", status: 415 };
  }
  if (!input.contentLength || !/^[1-9]\d*$/.test(input.contentLength)) {
    return { ok: false, error: "payload-too-large", status: 413 };
  }
  const contentLength = Number(input.contentLength);
  const actualLength = Buffer.byteLength(input.body, "utf8");
  if (
    !Number.isSafeInteger(contentLength) ||
    contentLength < 2 ||
    contentLength > MAX_GOOGLE_DRIVE_PROJECTION_BODY_BYTES ||
    actualLength > MAX_GOOGLE_DRIVE_PROJECTION_BODY_BYTES
  ) {
    return { ok: false, error: "payload-too-large", status: 413 };
  }
  if (actualLength !== contentLength) return { ok: false, error: "invalid-input", status: 400 };

  let value: unknown;
  try {
    value = JSON.parse(input.body);
  } catch {
    return { ok: false, error: "invalid-input", status: 400 };
  }
  const parsed = googleDriveSelectedFileRequestSchema.safeParse(value);
  return parsed.success
    ? { ok: true, data: parsed.data }
    : { ok: false, error: "invalid-input", status: 400 };
}

export function evaluateGoogleDriveInteractiveAuthorization(
  authorization: unknown,
  nowMs: number,
):
  | { usable: true; reason: "interactive-authorization-ready" }
  | { usable: false; reason: "invalid-authorization" | "not-yet-valid" | "expired" } {
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) {
    return { usable: false, reason: "invalid-authorization" };
  }
  const parsed = googleDriveInteractiveAuthorizationSchema.safeParse(authorization);
  if (!parsed.success) return { usable: false, reason: "invalid-authorization" };
  if (nowMs < parsed.data.issuedAtMs) return { usable: false, reason: "not-yet-valid" };
  if (nowMs >= parsed.data.expiresAtMs) return { usable: false, reason: "expired" };
  return { usable: true, reason: "interactive-authorization-ready" };
}

export const googleDriveNormalizedItemSchema = z.strictObject({
  id: googleDriveFileIdSchema,
  mimeType: z.string().trim().min(1).max(200).nullable(),
  parents: z.array(googleDriveFileIdSchema).max(2).nullable(),
  trashed: z.boolean().nullable(),
  shortcutDetails: z.strictObject({
    targetId: googleDriveFileIdSchema,
    targetMimeType: z.string().trim().min(1).max(200),
  }).nullable(),
});

export type GoogleDriveNormalizedItem = z.infer<typeof googleDriveNormalizedItemSchema>;

export type GoogleDriveBoundaryEvaluation =
  | {
      allowed: true;
      reason: "inside-configured-root";
      provenance: {
        source: "google-drive";
        fileId: string;
        rootFolderId: string;
        authorizationScope: typeof GOOGLE_DRIVE_FILE_SCOPE;
      };
    }
  | {
      allowed: false;
      reason:
        | "invalid-boundary-input"
        | "ancestry-unverifiable"
        | "outside-configured-root"
        | "shortcut-denied"
        | "trashed-item-denied"
        | "root-is-not-folder";
    };

const MAX_ANCESTRY_DEPTH = 64;

const googleDriveApiItemSchema = z.object({
  id: googleDriveFileIdSchema,
  name: z.string().trim().min(1).max(255).optional(),
  mimeType: z.string().trim().min(1).max(200),
  modifiedTime: z.iso.datetime({ offset: true }).optional(),
  size: z.string().regex(/^[1-9]\d*$/).optional(),
  sha256Checksum: googleDriveSha256ChecksumSchema.optional(),
  webViewLink: googleDriveHttpsUrlSchema.optional(),
  thumbnailLink: googleDriveHttpsUrlSchema.optional(),
  iconLink: googleDriveHttpsUrlSchema.optional(),
  parents: z.array(googleDriveFileIdSchema).max(2).optional(),
  trashed: z.boolean(),
  shortcutDetails: z.object({
    targetId: googleDriveFileIdSchema,
    targetMimeType: z.string().trim().min(1).max(200),
  }).nullable().optional(),
});

function driveMetadataUrl(fileId: string): string {
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`);
  url.searchParams.set("fields", "id,name,mimeType,modifiedTime,size,sha256Checksum,webViewLink,thumbnailLink,iconLink,parents,trashed,shortcutDetails(targetId,targetMimeType)");
  return url.toString();
}

function driveBinaryUrl(fileId: string): string {
  const url = new URL(`/drive/v3/files/${encodeURIComponent(fileId)}`, GOOGLE_DRIVE_API_ORIGIN);
  url.searchParams.set("alt", "media");
  if (url.protocol !== "https:" || url.origin !== GOOGLE_DRIVE_API_ORIGIN) {
    throw new Error("GOOGLE_DRIVE_API_ORIGIN_INVALID");
  }
  return url.toString();
}

type GoogleDriveApiItem = z.infer<typeof googleDriveApiItemSchema>;

async function fetchGoogleDriveAncestry(input: {
  rootFolderIds: readonly unknown[];
  selectedItemId: unknown;
  accessToken: string;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}): Promise<
  | { ok: true; items: GoogleDriveNormalizedItem[]; selectedItem: GoogleDriveApiItem }
  | { ok: false; reason: "invalid-boundary-input" | "ancestry-unverifiable" | "provider-unavailable" }
> {
  const rootFolderIds = googleDriveApprovedRootFolderIdsSchema.safeParse(input.rootFolderIds);
  const selectedItemId = googleDriveFileIdSchema.safeParse(input.selectedItemId);
  const accessToken = googleDriveAccessTokenSchema.safeParse(input.accessToken);
  if (!rootFolderIds.success || !selectedItemId.success || !accessToken.success) {
    return { ok: false, reason: "invalid-boundary-input" };
  }

  const approvedRoots = new Set(rootFolderIds.data);
  const items: GoogleDriveNormalizedItem[] = [];
  const visited = new Set<string>();
  let selectedItem: GoogleDriveApiItem | null = null;
  let currentId = selectedItemId.data;
  const fetchImpl = input.fetchImpl ?? fetch;

  for (let depth = 0; depth < MAX_ANCESTRY_DEPTH; depth += 1) {
    if (visited.has(currentId)) return { ok: false, reason: "ancestry-unverifiable" };
    visited.add(currentId);

    let response: Response;
    try {
      response = await fetchImpl(driveMetadataUrl(currentId), {
        headers: { Authorization: `Bearer ${accessToken.data}` },
        cache: "no-store",
        redirect: "error",
        signal: input.signal ?? AbortSignal.timeout(5_000),
      });
    } catch {
      return { ok: false, reason: "provider-unavailable" };
    }
    if (!response.ok) return { ok: false, reason: "provider-unavailable" };

    const parsed = googleDriveApiItemSchema.safeParse(await response.json().catch(() => null));
    if (!parsed.success || parsed.data.id !== currentId) {
      return { ok: false, reason: "ancestry-unverifiable" };
    }
    if (!selectedItem) selectedItem = parsed.data;
    items.push({
      id: parsed.data.id,
      mimeType: parsed.data.mimeType,
      parents: parsed.data.parents ?? [],
      trashed: parsed.data.trashed,
      shortcutDetails: parsed.data.shortcutDetails ?? null,
    });
    if (approvedRoots.has(currentId) || !parsed.data.parents?.length) break;
    if (parsed.data.parents.length !== 1) return { ok: false, reason: "ancestry-unverifiable" };
    currentId = parsed.data.parents[0]!;
  }

  return selectedItem
    ? { ok: true, items, selectedItem }
    : { ok: false, reason: "ancestry-unverifiable" };
}

export async function fetchGoogleDriveBoundaryEvidence(input: {
  rootFolderId: unknown;
  selectedItemId: unknown;
  accessToken: string;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}): Promise<GoogleDriveBoundaryEvaluation | { allowed: false; reason: "provider-unavailable" }> {
  const rootFolderId = googleDriveFileIdSchema.safeParse(input.rootFolderId);
  if (!rootFolderId.success) {
    return { allowed: false, reason: "invalid-boundary-input" };
  }

  const ancestry = await fetchGoogleDriveAncestry({
    rootFolderIds: [rootFolderId.data],
    selectedItemId: input.selectedItemId,
    accessToken: input.accessToken,
    signal: input.signal,
    fetchImpl: input.fetchImpl,
  });
  if (!ancestry.ok) return { allowed: false, reason: ancestry.reason };

  return evaluateGoogleDriveRootBoundary({
    rootFolderId: rootFolderId.data,
    selectedItemId: input.selectedItemId,
    items: ancestry.items,
  });
}

export type GoogleDriveSelectedFileProjectionResult =
  | { projected: true; item: GoogleDriveSelectedFileProjection }
  | {
      projected: false;
      reason:
        | "invalid-boundary-input"
        | "invalid-authorization"
        | "not-yet-valid"
        | "expired"
        | "provider-unavailable"
        | "selected-file-denied"
        | "selected-item-is-folder"
        | "metadata-unverifiable";
    };

export async function fetchGoogleDriveSelectedFileProjection(input: {
  rootFolderIds: readonly unknown[];
  selectedItemId: unknown;
  accessToken: string;
  authorization: unknown;
  nowMs: number;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}): Promise<GoogleDriveSelectedFileProjectionResult> {
  const rootFolderIds = googleDriveApprovedRootFolderIdsSchema.safeParse(input.rootFolderIds);
  if (!rootFolderIds.success) return { projected: false, reason: "invalid-boundary-input" };

  const authorization = evaluateGoogleDriveInteractiveAuthorization(input.authorization, input.nowMs);
  if (!authorization.usable) return { projected: false, reason: authorization.reason };

  const ancestry = await fetchGoogleDriveAncestry({
    rootFolderIds: rootFolderIds.data,
    selectedItemId: input.selectedItemId,
    accessToken: input.accessToken,
    signal: input.signal,
    fetchImpl: input.fetchImpl,
  });
  if (!ancestry.ok) {
    return {
      projected: false,
      reason: ancestry.reason === "provider-unavailable" ? "provider-unavailable" : "selected-file-denied",
    };
  }

  let insideApprovedRoot = false;
  for (const rootFolderId of rootFolderIds.data) {
    const evaluation = evaluateGoogleDriveRootBoundary({
      rootFolderId,
      selectedItemId: input.selectedItemId,
      items: ancestry.items,
    });
    if (evaluation.allowed) {
      insideApprovedRoot = true;
      break;
    }
  }
  if (!insideApprovedRoot) return { projected: false, reason: "selected-file-denied" };
  if (ancestry.selectedItem.mimeType === GOOGLE_DRIVE_FOLDER_MIME_TYPE) {
    return { projected: false, reason: "selected-item-is-folder" };
  }

  const item = googleDriveSelectedFileProjectionSchema.safeParse({
    id: ancestry.selectedItem.id,
    name: ancestry.selectedItem.name,
    mimeType: ancestry.selectedItem.mimeType,
    modifiedTime: ancestry.selectedItem.modifiedTime,
    sha256Checksum: ancestry.selectedItem.sha256Checksum,
    webViewLink: ancestry.selectedItem.webViewLink ?? null,
    thumbnailLink: ancestry.selectedItem.thumbnailLink ?? null,
    iconLink: ancestry.selectedItem.iconLink ?? null,
  });
  return item.success
    ? { projected: true, item: item.data }
    : { projected: false, reason: "metadata-unverifiable" };
}

export type GoogleDriveSelectedFileBinaryResult =
  | {
      ready: true;
      file: {
        id: string;
        name: string;
        mimeType: z.infer<typeof googleDriveDownloadMimeTypeSchema>;
        byteSize: number;
        sha256Checksum: string;
        body: ReadableStream<Uint8Array>;
      };
    }
  | {
      ready: false;
      reason:
        | "invalid-boundary-input"
        | "invalid-authorization"
        | "not-yet-valid"
        | "expired"
        | "provider-unavailable"
        | "selected-file-denied"
        | "selected-item-is-folder"
        | "media-metadata-mismatch"
        | "media-response-unverifiable";
    };

// At most the existing ten 1GB files may be staged in this process. Disk
// pressure is a resource denial, never permission to send unverified bytes.
const MAX_GOOGLE_DRIVE_STAGED_BYTES = 10 * MAX_GOOGLE_DRIVE_BINARY_BYTES;
const GOOGLE_DRIVE_STAGING_RESERVE_BYTES = 256 * 1024 * 1024;
let stagedBytes = 0;
let unwrittenBytes = 0;
const stagedDisposals = new WeakMap<ReadableStream<Uint8Array>, () => Promise<void>>();

function canStageGoogleDriveMedia(bytes: number, reserved: number, pending: number, available: number) {
  return Number.isSafeInteger(bytes) && bytes > 0 && bytes <= MAX_GOOGLE_DRIVE_BINARY_BYTES
    && Number.isSafeInteger(reserved) && reserved >= 0 && reserved + bytes <= MAX_GOOGLE_DRIVE_STAGED_BYTES
    && Number.isSafeInteger(pending) && pending >= 0 && Number.isSafeInteger(available)
    && available - pending - bytes >= GOOGLE_DRIVE_STAGING_RESERVE_BYTES;
}

/** Disposal remains available even when a provider has locked the Web stream. */
export async function disposeGoogleDriveSelectedFileBinary(body: ReadableStream<Uint8Array>) {
  const dispose = stagedDisposals.get(body);
  if (dispose) await dispose();
  else await body.cancel().catch(() => undefined);
}

async function verifiedMediaStream(body: ReadableStream<Uint8Array>, bytes: number, checksum: string, signal: AbortSignal) {
  if (stagedBytes + bytes > MAX_GOOGLE_DRIVE_STAGED_BYTES) throw new Error("GOOGLE_DRIVE_MEDIA_STAGING_DENIED");
  const reader = body.getReader();
  const previousReserved = stagedBytes;
  const previousPending = unwrittenBytes;
  stagedBytes += bytes;
  unwrittenBytes += bytes;
  let pending = bytes;
  let directory: string | undefined;
  let file: FileHandle | undefined;
  let disposed = false;
  let closePromise: Promise<void> | undefined;
  let streamController: ReadableStreamDefaultController<Uint8Array> | undefined;
  let streamEnded = false;
  const release = () => {
    if (closePromise) return closePromise;
    disposed = true;
    closePromise = (async () => {
      await file?.close().catch(() => undefined);
      if (directory) await rm(directory, { recursive: true, force: true }).catch(() => undefined);
      stagedBytes -= bytes;
      unwrittenBytes -= pending;
      pending = 0;
    })();
    return closePromise;
  };
  const onAbort = () => { void reader.cancel().catch(() => undefined); };
  signal.addEventListener("abort", onAbort, { once: true });
  try {
    signal.throwIfAborted();
    const disk = await statfs(tmpdir());
    // Include reservations made while statfs was pending, without counting
    // already-written bytes twice (the filesystem already subtracts those).
    if (!canStageGoogleDriveMedia(bytes, previousReserved, previousPending, Number(disk.bavail) * Number(disk.bsize))
      || Number(disk.bavail) * Number(disk.bsize) - unwrittenBytes < GOOGLE_DRIVE_STAGING_RESERVE_BYTES) {
      throw new Error("GOOGLE_DRIVE_MEDIA_STAGING_DENIED");
    }
    directory = await mkdtemp(join(tmpdir(), "ccpun-approved-media-"));
    await chmod(directory, 0o700);
    const filename = join(directory, "media");
    file = await open(filename, "wx+", 0o600);
    // Unlink BEFORE the first media byte. No named file can be swapped or left
    // with media content after a crash; the kernel reclaims the open descriptor.
    await unlink(filename);
    await rmdir(directory);
    directory = undefined;
    const hash = createHash("sha256");
    let received = 0;
    while (true) {
      signal.throwIfAborted();
      const chunk = await reader.read();
      signal.throwIfAborted();
      if (chunk.done) break;
      if (!(chunk.value instanceof Uint8Array) || received + chunk.value.byteLength > bytes) {
        throw new Error("GOOGLE_DRIVE_MEDIA_SIZE_MISMATCH");
      }
      // Bound individual filesystem writes even if the upstream emits a large chunk.
      for (let offset = 0; offset < chunk.value.byteLength;) {
        signal.throwIfAborted();
        const part = chunk.value.slice(offset, Math.min(offset + 64 * 1024, chunk.value.byteLength));
        const written = await file.write(part, 0, part.byteLength, received);
        if (written.bytesWritten <= 0) throw new Error("GOOGLE_DRIVE_MEDIA_STAGING_DENIED");
        hash.update(part.subarray(0, written.bytesWritten));
        received += written.bytesWritten;
        offset += written.bytesWritten;
        pending -= written.bytesWritten;
        unwrittenBytes -= written.bytesWritten;
      }
    }
    if (received !== bytes || hash.digest("hex") !== checksum) throw new Error("GOOGLE_DRIVE_MEDIA_BYTES_MISMATCH");
    signal.throwIfAborted();
    let position = 0;
    const verified = new ReadableStream<Uint8Array>({
      start(controller) { streamController = controller; },
      async pull(controller) {
        try {
          if (disposed || !file) throw new Error("GOOGLE_DRIVE_MEDIA_CLOSED");
          const buffer = new Uint8Array(Math.min(64 * 1024, bytes - position));
          if (buffer.byteLength === 0) {
            streamEnded = true;
            controller.close();
            await release();
            return;
          }
          const read = await file.read(buffer, 0, buffer.byteLength, position);
          if (disposed || read.bytesRead === 0) throw new Error("GOOGLE_DRIVE_MEDIA_CLOSED");
          position += read.bytesRead;
          controller.enqueue(buffer.subarray(0, read.bytesRead));
        } catch {
          if (!streamEnded) { streamEnded = true; controller.error(new Error("GOOGLE_DRIVE_MEDIA_CLOSED")); }
          await release();
        }
      },
      async cancel() { streamEnded = true; await release(); },
    });
    stagedDisposals.set(verified, async () => {
      if (!streamEnded) { streamEnded = true; streamController?.error(new Error("GOOGLE_DRIVE_MEDIA_CLOSED")); }
      await release();
    });
    return verified;
  } catch {
    void reader.cancel().catch(() => undefined);
    await release();
    throw new Error("GOOGLE_DRIVE_MEDIA_UNVERIFIED");
  } finally {
    signal.removeEventListener("abort", onAbort);
    reader.releaseLock();
  }
}

/**
 * Opens one approved Drive file as a bounded stream for the current manual request.
 * The access token is used only in outbound headers and is never returned or persisted.
 */
export async function fetchGoogleDriveSelectedFileBinary(input: {
  rootFolderIds: readonly unknown[];
  selectedItemId: unknown;
  accessToken: string;
  authorization: unknown;
  nowMs: number;
  expectedMimeType: unknown;
  expectedByteSize: unknown;
  expectedSha256Checksum: unknown;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}): Promise<GoogleDriveSelectedFileBinaryResult> {
  const rootFolderIds = googleDriveApprovedRootFolderIdsSchema.safeParse(input.rootFolderIds);
  const selectedItemId = googleDriveFileIdSchema.safeParse(input.selectedItemId);
  const accessToken = googleDriveAccessTokenSchema.safeParse(input.accessToken);
  const expectedMimeType = googleDriveDownloadMimeTypeSchema.safeParse(input.expectedMimeType);
  const expectedByteSize = z.number().int().min(1).max(MAX_GOOGLE_DRIVE_BINARY_BYTES).safeParse(input.expectedByteSize);
  const expectedSha256Checksum = googleDriveSha256ChecksumSchema.safeParse(input.expectedSha256Checksum);
  if (!rootFolderIds.success || !selectedItemId.success || !accessToken.success || !expectedMimeType.success
    || !expectedByteSize.success || !expectedSha256Checksum.success) {
    return { ready: false, reason: "invalid-boundary-input" };
  }

  const authorization = evaluateGoogleDriveInteractiveAuthorization(input.authorization, input.nowMs);
  if (!authorization.usable) return { ready: false, reason: authorization.reason };

  const deadline = AbortSignal.timeout(input.signal ? 5 * 60_000 : 60_000);
  const signal = input.signal ? AbortSignal.any([input.signal, deadline]) : deadline;
  const ancestry = await fetchGoogleDriveAncestry({
    rootFolderIds: rootFolderIds.data,
    selectedItemId: selectedItemId.data,
    accessToken: accessToken.data,
    signal,
    fetchImpl: input.fetchImpl,
  });
  if (!ancestry.ok) {
    return {
      ready: false,
      reason: ancestry.reason === "provider-unavailable" ? "provider-unavailable" : "selected-file-denied",
    };
  }

  const insideApprovedRoot = rootFolderIds.data.some((rootFolderId) => evaluateGoogleDriveRootBoundary({
    rootFolderId,
    selectedItemId: selectedItemId.data,
    items: ancestry.items,
  }).allowed);
  if (!insideApprovedRoot) return { ready: false, reason: "selected-file-denied" };
  if (ancestry.selectedItem.mimeType === GOOGLE_DRIVE_FOLDER_MIME_TYPE) {
    return { ready: false, reason: "selected-item-is-folder" };
  }

  const fileName = googleDriveSelectedFileProjectionSchema.shape.name.safeParse(ancestry.selectedItem.name);
  const metadataByteSize = Number(ancestry.selectedItem.size);
  if (
    !fileName.success
    || ancestry.selectedItem.mimeType !== expectedMimeType.data
    || !Number.isSafeInteger(metadataByteSize)
    || metadataByteSize !== expectedByteSize.data
    || ancestry.selectedItem.sha256Checksum !== expectedSha256Checksum.data
  ) {
    return { ready: false, reason: "media-metadata-mismatch" };
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(driveBinaryUrl(selectedItemId.data), {
      method: "GET",
      headers: {
        Accept: expectedMimeType.data,
        Authorization: `Bearer ${accessToken.data}`,
      },
      cache: "no-store",
      redirect: "error",
      signal,
    });
  } catch {
    return { ready: false, reason: "provider-unavailable" };
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    return { ready: false, reason: "provider-unavailable" };
  }

  const responseMimeType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  const contentLengthHeader = response.headers.get("content-length");
  const responseByteSize = contentLengthHeader && /^[1-9]\d*$/.test(contentLengthHeader)
    ? Number(contentLengthHeader)
    : null;
  if (
    responseMimeType !== expectedMimeType.data
    || (responseByteSize !== null && (!Number.isSafeInteger(responseByteSize) || responseByteSize !== expectedByteSize.data))
    || !response.body
  ) {
    await response.body?.cancel().catch(() => undefined);
    return { ready: false, reason: "media-response-unverifiable" };
  }

  let verifiedBody: ReadableStream<Uint8Array>;
  try {
    verifiedBody = await verifiedMediaStream(response.body, expectedByteSize.data, expectedSha256Checksum.data, signal);
  } catch {
    void response.body.cancel().catch(() => undefined);
    return { ready: false, reason: "media-response-unverifiable" };
  }
  return {
    ready: true,
    file: {
      id: ancestry.selectedItem.id,
      name: fileName.data,
      mimeType: expectedMimeType.data,
      byteSize: expectedByteSize.data,
      sha256Checksum: expectedSha256Checksum.data,
      body: verifiedBody,
    },
  };
}

export function evaluateGoogleDriveRootBoundary(input: {
  rootFolderId: unknown;
  selectedItemId: unknown;
  /** Trusted server-normalized Drive API metadata only; never accept client assertions here. */
  items: readonly unknown[];
}): GoogleDriveBoundaryEvaluation {
  const boundary = googleDriveRootBoundarySchema.safeParse({
    rootFolderId: input.rootFolderId,
    authorizationBasis: "exact-immutable-folder-id",
  });
  const selectedItemId = googleDriveFileIdSchema.safeParse(input.selectedItemId);
  const items = z.array(googleDriveNormalizedItemSchema).max(128).safeParse(input.items);
  if (!boundary.success || !selectedItemId.success || !items.success) {
    return { allowed: false, reason: "invalid-boundary-input" };
  }

  const itemsById = new Map<string, GoogleDriveNormalizedItem>();
  for (const item of items.data) {
    if (itemsById.has(item.id)) return { allowed: false, reason: "ancestry-unverifiable" };
    itemsById.set(item.id, item);
  }

  const visited = new Set<string>();
  let currentId = selectedItemId.data;
  for (let depth = 0; depth < MAX_ANCESTRY_DEPTH; depth += 1) {
    if (visited.has(currentId)) return { allowed: false, reason: "ancestry-unverifiable" };
    visited.add(currentId);

    const current = itemsById.get(currentId);
    if (!current || current.trashed === null || current.mimeType === null) {
      return { allowed: false, reason: "ancestry-unverifiable" };
    }
    if (current.trashed) return { allowed: false, reason: "trashed-item-denied" };
    if (current.mimeType === GOOGLE_DRIVE_SHORTCUT_MIME_TYPE || current.shortcutDetails !== null) {
      return { allowed: false, reason: "shortcut-denied" };
    }

    if (currentId === boundary.data.rootFolderId) {
      if (current.mimeType !== GOOGLE_DRIVE_FOLDER_MIME_TYPE) {
        return { allowed: false, reason: "root-is-not-folder" };
      }
      return {
        allowed: true,
        reason: "inside-configured-root",
        provenance: {
          source: "google-drive",
          fileId: selectedItemId.data,
          rootFolderId: boundary.data.rootFolderId,
          authorizationScope: GOOGLE_DRIVE_FILE_SCOPE,
        },
      };
    }

    if (current.parents === null || current.parents.length > 1) {
      return { allowed: false, reason: "ancestry-unverifiable" };
    }
    if (current.parents.length === 0) {
      return { allowed: false, reason: "outside-configured-root" };
    }
    currentId = current.parents[0];
  }

  return { allowed: false, reason: "ancestry-unverifiable" };
}
