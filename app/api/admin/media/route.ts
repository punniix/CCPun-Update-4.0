import { NextResponse } from "next/server";
import { isConfiguredAdminOrigin, isSameOriginAdminMutation } from "@/lib/admin/auth-config";
import { getAdminIdentity } from "@/lib/admin/identity";
import { hasAdminPermission } from "@/lib/admin/rbac";
import {
  getMediaLibraryRuntimeStatus,
  getMediaStorageProviderState,
  isGoogleDriveSelectedFileVerificationEnabled,
  mediaLibrarySnapshotSchema,
  SYNTHETIC_MEDIA_LIBRARY,
} from "@/lib/admin/media/foundation";
import {
  fetchGoogleDriveSelectedFileProjection,
  MAX_GOOGLE_DRIVE_PROJECTION_BODY_BYTES,
  parseGoogleDriveApprovedRootFolderIds,
  validateGoogleDriveProjectionHttpRequest,
} from "@/lib/admin/media/google-drive-foundation";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

export async function GET(request: Request) {
  const identity = await getAdminIdentity();
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE_HEADERS });
  if (!hasAdminPermission(identity.role, "social:read")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers: NO_STORE_HEADERS });
  }
  if (!isConfiguredAdminOrigin(request.url, process.env.AUTH_URL)) {
    return NextResponse.json({ error: "forbidden-origin" }, { status: 403, headers: NO_STORE_HEADERS });
  }
  if (!getMediaLibraryRuntimeStatus().enabled) {
    return NextResponse.json({ error: "not-found" }, { status: 404, headers: NO_STORE_HEADERS });
  }

  return NextResponse.json(
    {
      snapshot: mediaLibrarySnapshotSchema.parse(SYNTHETIC_MEDIA_LIBRARY),
      storage: getMediaStorageProviderState(),
      limitations: [
        "ข้อมูลทั้งหมดเป็น synthetic UAT",
        "ยังไม่เชื่อม storage provider",
        "ไม่มี media URL หรือข้อมูลรับรองสิทธิ์ในผลลัพธ์",
        "ยังไม่มีการอัปโหลดหรือส่งสื่อจริง",
      ],
    },
    { headers: NO_STORE_HEADERS },
  );
}

export async function POST(request: Request) {
  const identity = await getAdminIdentity();
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE_HEADERS });
  if (identity.actorType !== "human" || identity.role !== "owner" || !hasAdminPermission(identity.role, "social:read")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers: NO_STORE_HEADERS });
  }
  if (
    !isConfiguredAdminOrigin(request.url, process.env.AUTH_URL) ||
    !isSameOriginAdminMutation(request.url, request.headers.get("origin"))
  ) {
    return NextResponse.json({ error: "forbidden-origin" }, { status: 403, headers: NO_STORE_HEADERS });
  }
  if (!isGoogleDriveSelectedFileVerificationEnabled(process.env)) {
    return NextResponse.json({ error: "not-found" }, { status: 404, headers: NO_STORE_HEADERS });
  }

  const rawContentLength = request.headers.get("content-length");
  if (!rawContentLength || !/^[1-9]\d*$/.test(rawContentLength) || Number(rawContentLength) > MAX_GOOGLE_DRIVE_PROJECTION_BODY_BYTES) {
    return NextResponse.json({ error: "payload-too-large" }, { status: 413, headers: NO_STORE_HEADERS });
  }
  const body = await request.text();
  const validation = validateGoogleDriveProjectionHttpRequest({
    contentType: request.headers.get("content-type"),
    contentLength: rawContentLength,
    body,
  });
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: validation.status, headers: NO_STORE_HEADERS });
  }

  const rootFolderIds = parseGoogleDriveApprovedRootFolderIds([
    process.env.CCPUN_GOOGLE_DRIVE_ADMIN_ROOT_FOLDER_ID,
    process.env.CCPUN_GOOGLE_DRIVE_MEDIA_ROOT_FOLDER_ID,
  ]);
  if (!rootFolderIds || rootFolderIds.length !== 2) {
    return NextResponse.json({ error: "drive-roots-not-configured" }, { status: 409, headers: NO_STORE_HEADERS });
  }

  const nowMs = Date.now();
  const result = await fetchGoogleDriveSelectedFileProjection({
    rootFolderIds,
    selectedItemId: validation.data.selectedFileId,
    accessToken: validation.data.accessToken,
    authorization: validation.data.authorization,
    nowMs,
  });
  if (!result.projected) {
    if (["invalid-authorization", "not-yet-valid", "expired"].includes(result.reason)) {
      return NextResponse.json({ error: "manual-authorization-required" }, { status: 401, headers: NO_STORE_HEADERS });
    }
    if (result.reason === "provider-unavailable" || result.reason === "metadata-unverifiable") {
      return NextResponse.json({ error: "drive-provider-unavailable" }, { status: 502, headers: NO_STORE_HEADERS });
    }
    return NextResponse.json({ error: "selected-file-denied" }, { status: 403, headers: NO_STORE_HEADERS });
  }

  return NextResponse.json(
    {
      source: "google-drive",
      refreshMode: "manual",
      refreshedAt: new Date(nowMs).toISOString(),
      item: result.item,
    },
    { headers: NO_STORE_HEADERS },
  );
}
