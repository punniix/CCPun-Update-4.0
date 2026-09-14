import { z } from "zod";
import { isConfiguredAdminOrigin, isSameOriginAdminMutation } from "@/lib/admin/auth-config";
import { getAdminIdentity } from "@/lib/admin/identity";
import { getMediaLibraryRuntimeStatus } from "@/lib/admin/media/foundation";
import {
  fetchGoogleDriveSelectedFileBinary,
  googleDriveSelectedFileRequestSchema,
  MAX_GOOGLE_DRIVE_PROJECTION_BODY_BYTES,
  parseGoogleDriveApprovedRootFolderIds,
} from "@/lib/admin/media/google-drive-foundation";
import { hasAdminPermission } from "@/lib/admin/rbac";
import { listApprovedSocialVariants } from "@/lib/admin/social/publishing-store";

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } as const;
const expectedSchema = z.strictObject({
  expectedMimeType: z.enum(["image/jpeg", "image/png", "image/webp", "video/mp4"]),
  expectedByteSize: z.number().int().min(1).max(1_000_000_000),
  expectedSha256Checksum: z.string().regex(/^[0-9a-f]{64}$/),
  disposition: z.enum(["inline", "attachment"]),
  variantId: z.string().trim().min(1).max(120).regex(/^[A-Za-z0-9_.:-]+$/),
  approvedRevision: z.string().trim().min(1).max(120),
  approvedVersion: z.number().int().min(1),
});

function invalid(status = 400) {
  return Response.json({ error: "invalid-request" }, { status, headers: NO_STORE_HEADERS });
}

function contentDisposition(mode: "inline" | "attachment", name: string) {
  const fallback = name.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_").slice(0, 120) || "instagram-media";
  const encoded = encodeURIComponent(name).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${mode}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

export async function POST(request: Request) {
  const identity = await getAdminIdentity();
  if (!identity) return Response.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE_HEADERS });
  if (identity.actorType !== "human" || !hasAdminPermission(identity.role, "social:read")) {
    return Response.json({ error: "forbidden" }, { status: 403, headers: NO_STORE_HEADERS });
  }
  if (!isConfiguredAdminOrigin(request.url, process.env.AUTH_URL)
    || !isSameOriginAdminMutation(request.url, request.headers.get("origin"))) {
    return Response.json({ error: "forbidden-origin" }, { status: 403, headers: NO_STORE_HEADERS });
  }
  if (!getMediaLibraryRuntimeStatus().enabled) {
    return Response.json({ error: "not-found" }, { status: 404, headers: NO_STORE_HEADERS });
  }
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  const rawLength = request.headers.get("content-length");
  if (contentType !== "application/x-www-form-urlencoded") return invalid(415);
  if (!rawLength || !/^[1-9]\d*$/.test(rawLength) || Number(rawLength) > MAX_GOOGLE_DRIVE_PROJECTION_BODY_BYTES) return invalid(413);
  const body = await request.text();
  if (Buffer.byteLength(body, "utf8") !== Number(rawLength)) return invalid();
  const params = new URLSearchParams(body);
  const expectedKeys = [
    "selectedFileId", "accessToken", "authorization", "expectedMimeType",
    "expectedByteSize", "expectedSha256Checksum", "disposition", "variantId",
    "approvedRevision", "approvedVersion",
  ];
  if ([...params.keys()].length !== expectedKeys.length
    || expectedKeys.some((key) => params.getAll(key).length !== 1)
    || [...params.keys()].some((key) => !expectedKeys.includes(key))) return invalid();

  let authorization: unknown;
  try {
    authorization = JSON.parse(params.get("authorization") ?? "");
  } catch {
    return invalid();
  }
  const driveRequest = googleDriveSelectedFileRequestSchema.safeParse({
    selectedFileId: params.get("selectedFileId"),
    accessToken: params.get("accessToken"),
    authorization,
  });
  const expected = expectedSchema.safeParse({
    expectedMimeType: params.get("expectedMimeType"),
    expectedByteSize: Number(params.get("expectedByteSize")),
    expectedSha256Checksum: params.get("expectedSha256Checksum"),
    disposition: params.get("disposition"),
    variantId: params.get("variantId"),
    approvedRevision: params.get("approvedRevision"),
    approvedVersion: Number(params.get("approvedVersion")),
  });
  if (!driveRequest.success || !expected.success) return invalid();

  const rootFolderIds = parseGoogleDriveApprovedRootFolderIds([
    process.env.CCPUN_GOOGLE_DRIVE_ADMIN_ROOT_FOLDER_ID,
    process.env.CCPUN_GOOGLE_DRIVE_MEDIA_ROOT_FOLDER_ID,
  ]);
  if (!rootFolderIds || rootFolderIds.length !== 2) {
    return Response.json({ error: "drive-roots-not-configured" }, { status: 409, headers: NO_STORE_HEADERS });
  }
  let variant;
  try {
    variant = (await listApprovedSocialVariants()).find((item) => item.variantId === expected.data.variantId);
  } catch {
    return Response.json({ error: "handoff-not-ready" }, { status: 409, headers: NO_STORE_HEADERS });
  }
  const approvedMedia = variant?.mediaMetadata.find((item) => item.assetId === driveRequest.data.selectedFileId);
  if (!variant || variant.platform !== "instagram" || variant.revision !== expected.data.approvedRevision
    || variant.version !== expected.data.approvedVersion || variant.publication?.status !== "awaiting-native-finish"
    || variant.publication.approvedRevision !== expected.data.approvedRevision
    || variant.publication.approvedVersion !== expected.data.approvedVersion
    || !approvedMedia || approvedMedia.mimeType !== expected.data.expectedMimeType
    || approvedMedia.sha256Checksum !== expected.data.expectedSha256Checksum) {
    return Response.json({ error: "approved-handoff-mismatch" }, { status: 409, headers: NO_STORE_HEADERS });
  }
  const result = await fetchGoogleDriveSelectedFileBinary({
    rootFolderIds,
    selectedItemId: driveRequest.data.selectedFileId,
    accessToken: driveRequest.data.accessToken,
    authorization: driveRequest.data.authorization,
    nowMs: Date.now(),
    expectedMimeType: expected.data.expectedMimeType,
    expectedByteSize: expected.data.expectedByteSize,
    expectedSha256Checksum: expected.data.expectedSha256Checksum,
  });
  if (!result.ready) {
    const status = ["invalid-authorization", "not-yet-valid", "expired"].includes(result.reason) ? 401
      : result.reason === "provider-unavailable" ? 502
        : 403;
    return Response.json({ error: status === 401 ? "manual-authorization-required" : status === 502 ? "drive-provider-unavailable" : "selected-file-denied" }, {
      status,
      headers: NO_STORE_HEADERS,
    });
  }

  return new Response(result.file.body, {
    headers: {
      ...NO_STORE_HEADERS,
      "Content-Disposition": contentDisposition(expected.data.disposition, result.file.name),
      "Content-Length": String(result.file.byteSize),
      "Content-Type": result.file.mimeType,
    },
  });
}
