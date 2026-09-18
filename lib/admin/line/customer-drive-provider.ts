if (typeof window !== "undefined") throw new Error("CCPUN_CUSTOMER_DRIVE_PROVIDER_SERVER_ONLY");

import { z } from "zod";
import {
  evaluateGoogleDriveInteractiveAuthorization,
  GOOGLE_DRIVE_FILE_SCOPE,
  GOOGLE_DRIVE_FOLDER_MIME_TYPE,
  googleDriveFileIdSchema,
  type GoogleDriveInteractiveAuthorization,
} from "../media/google-drive-foundation";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const safeDigestSchema = z.string().regex(/^[0-9a-f]{64}$/);
const accessTokenSchema = z.string().trim().min(1).max(8_192).regex(/^[\x21-\x7E]+$/);
const mimeTypeSchema = z.string().trim().min(1).max(200).regex(/^[A-Za-z0-9][A-Za-z0-9!#$&^_.+\-/]+$/);

type DriveAuth = {
  accessToken: string;
  authorization: GoogleDriveInteractiveAuthorization;
  nowMs: number;
  rootFolderId: string;
};

type DriveFile = {
  id: string;
  mimeType?: string;
  parents?: string[];
  trashed?: boolean;
};

export type CustomerDriveProvider =
  | {
      ready: false;
      reason: "invalid-authorization" | "not-yet-valid" | "expired" | "invalid-boundary-input";
    }
  | {
      ready: true;
      scope: typeof GOOGLE_DRIVE_FILE_SCOPE;
      ensureCustomerFolder(customerFolderDigest: string): Promise<
        | { ok: true; status: "ready" | "already_exists"; externalFolderId: string }
        | { ok: false; status: "unsafe_permissions" | "provider_failed" | "reconciliation_required" }
      >;
      uploadDocument(input: {
        externalFolderId: string;
        documentDigest: string;
        mimeType: string;
        body: Blob;
      }): Promise<
        | { ok: true; status: "stored" | "already_stored"; externalFileId: string }
        | { ok: false; status: "unsafe_permissions" | "provider_failed" | "reconciliation_required" }
      >;
      deleteDocument(externalFileId: string): Promise<
        | { ok: true; status: "deleted" | "already_absent" }
        | { ok: false; status: "provider_failed" | "reconciliation_required" }
      >;
    };

function bearer(token: string, contentType?: string) {
  return {
    Authorization: `Bearer ${token}`,
    ...(contentType ? { "Content-Type": contentType } : {}),
  };
}

function driveUrl(path: string, search?: URLSearchParams) {
  const url = new URL(`${DRIVE_API}${path}`);
  if (search) url.search = search.toString();
  return url.toString();
}

async function jsonObject(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const value = await response.json();
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function parseFile(value: unknown): DriveFile | null {
  const parsed = z.object({
    id: googleDriveFileIdSchema,
    mimeType: z.string().optional(),
    parents: z.array(googleDriveFileIdSchema).max(2).optional(),
    trashed: z.boolean().optional(),
  }).safeParse(value);
  return parsed.success ? parsed.data : null;
}

async function readFile(
  fileId: string,
  token: string,
  fetchImpl: typeof fetch,
): Promise<DriveFile | null> {
  const response = await fetchImpl(
    driveUrl(`/files/${encodeURIComponent(fileId)}`, new URLSearchParams({
      fields: "id,mimeType,parents,trashed",
      supportsAllDrives: "false",
    })),
    {
      method: "GET",
      headers: bearer(token),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    return null;
  }
  return parseFile(await response.json());
}

async function isOwnerOnlyPrivate(
  fileId: string,
  token: string,
  fetchImpl: typeof fetch,
): Promise<boolean | null> {
  let response: Response;
  try {
    response = await fetchImpl(
      driveUrl(`/files/${encodeURIComponent(fileId)}/permissions`, new URLSearchParams({
        fields: "permissions(type,role),nextPageToken",
        pageSize: "100",
        supportsAllDrives: "false",
      })),
      {
        method: "GET",
        headers: bearer(token),
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      },
    );
  } catch {
    return null;
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    return null;
  }
  const raw = await jsonObject(response);
  const parsed = z.object({
    permissions: z.array(z.object({
      type: z.string(),
      role: z.string(),
    })).min(1).max(100),
    nextPageToken: z.string().optional(),
  }).safeParse(raw);
  if (!parsed.success || parsed.data.nextPageToken) return null;
  return parsed.data.permissions.every((permission) =>
    permission.type === "user" && permission.role === "owner"
  );
}

async function assertPrivateFolder(
  folderId: string,
  expectedParentId: string | null,
  token: string,
  fetchImpl: typeof fetch,
): Promise<"private" | "unsafe" | "provider_failed"> {
  let item: DriveFile | null;
  try {
    item = await readFile(folderId, token, fetchImpl);
  } catch {
    return "provider_failed";
  }
  if (!item || item.trashed || item.mimeType !== GOOGLE_DRIVE_FOLDER_MIME_TYPE) return "provider_failed";
  if (expectedParentId !== null && !item.parents?.includes(expectedParentId)) return "provider_failed";
  const permissions = await isOwnerOnlyPrivate(folderId, token, fetchImpl);
  if (permissions === null) return "provider_failed";
  return permissions ? "private" : "unsafe";
}

async function searchByAppProperty(input: {
  parentId: string;
  key: "ccpunCustomerFolderDigest" | "ccpunDocumentDigest";
  value: string;
  token: string;
  fetchImpl: typeof fetch;
}) {
  const q = [
    `'${input.parentId}' in parents`,
    "trashed = false",
    `appProperties has { key='${input.key}' and value='${input.value}' }`,
  ].join(" and ");
  const response = await input.fetchImpl(
    driveUrl("/files", new URLSearchParams({
      q,
      spaces: "drive",
      fields: "files(id,mimeType,parents,trashed)",
      pageSize: "3",
      orderBy: "createdTime asc",
    })),
    {
      method: "GET",
      headers: bearer(input.token),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    return null;
  }
  const raw = await jsonObject(response);
  const parsed = z.object({ files: z.array(z.unknown()).max(3) }).safeParse(raw);
  if (!parsed.success) return null;
  return parsed.data.files.map(parseFile).filter((item): item is DriveFile => item !== null);
}

export function createCustomerDriveProvider(
  auth: DriveAuth,
  fetchImpl: typeof fetch = fetch,
): CustomerDriveProvider {
  const token = accessTokenSchema.safeParse(auth.accessToken);
  const root = googleDriveFileIdSchema.safeParse(auth.rootFolderId);
  if (!token.success || !root.success) return { ready: false, reason: "invalid-boundary-input" };
  const authorization = evaluateGoogleDriveInteractiveAuthorization(auth.authorization, auth.nowMs);
  if (!authorization.usable) return { ready: false, reason: authorization.reason };

  const accessToken = token.data;
  const rootFolderId = root.data;

  return {
    ready: true,
    scope: GOOGLE_DRIVE_FILE_SCOPE,

    async ensureCustomerFolder(customerFolderDigest) {
      const digest = safeDigestSchema.safeParse(customerFolderDigest);
      if (!digest.success) return { ok: false, status: "provider_failed" };

      const rootPrivacy = await assertPrivateFolder(rootFolderId, null, accessToken, fetchImpl);
      if (rootPrivacy === "unsafe") return { ok: false, status: "unsafe_permissions" };
      if (rootPrivacy !== "private") return { ok: false, status: "provider_failed" };

      let matches: DriveFile[] | null;
      try {
        matches = await searchByAppProperty({
          parentId: rootFolderId,
          key: "ccpunCustomerFolderDigest",
          value: digest.data,
          token: accessToken,
          fetchImpl,
        });
      } catch {
        return { ok: false, status: "provider_failed" };
      }
      if (!matches) return { ok: false, status: "provider_failed" };
      if (matches.length > 1) return { ok: false, status: "reconciliation_required" };
      if (matches.length === 1) {
        const existing = matches[0];
        const privacy = await assertPrivateFolder(existing.id, rootFolderId, accessToken, fetchImpl);
        if (privacy === "unsafe") return { ok: false, status: "unsafe_permissions" };
        if (privacy !== "private") return { ok: false, status: "provider_failed" };
        return { ok: true, status: "already_exists", externalFolderId: existing.id };
      }

      let response: Response;
      try {
        response = await fetchImpl(
          driveUrl("/files", new URLSearchParams({ fields: "id,mimeType,parents,trashed" })),
          {
            method: "POST",
            headers: bearer(accessToken, "application/json"),
            body: JSON.stringify({
              name: `CCPun Customer ${digest.data.slice(0, 12)}`,
              mimeType: GOOGLE_DRIVE_FOLDER_MIME_TYPE,
              parents: [rootFolderId],
              appProperties: { ccpunCustomerFolderDigest: digest.data },
            }),
            redirect: "error",
            signal: AbortSignal.timeout(10_000),
          },
        );
      } catch {
        return { ok: false, status: "reconciliation_required" };
      }
      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        return { ok: false, status: "provider_failed" };
      }
      const created = parseFile(await response.json());
      if (!created) return { ok: false, status: "reconciliation_required" };
      const privacy = await assertPrivateFolder(created.id, rootFolderId, accessToken, fetchImpl);
      if (privacy === "unsafe") return { ok: false, status: "unsafe_permissions" };
      if (privacy !== "private") return { ok: false, status: "provider_failed" };
      return { ok: true, status: "ready", externalFolderId: created.id };
    },

    async uploadDocument(input) {
      const folder = googleDriveFileIdSchema.safeParse(input.externalFolderId);
      const digest = safeDigestSchema.safeParse(input.documentDigest);
      const mimeType = mimeTypeSchema.safeParse(input.mimeType);
      if (!folder.success || !digest.success || !mimeType.success || !(input.body instanceof Blob) || input.body.size <= 0) {
        return { ok: false, status: "provider_failed" };
      }

      const folderPrivacy = await assertPrivateFolder(folder.data, rootFolderId, accessToken, fetchImpl);
      if (folderPrivacy === "unsafe") return { ok: false, status: "unsafe_permissions" };
      if (folderPrivacy !== "private") return { ok: false, status: "provider_failed" };

      let matches: DriveFile[] | null;
      try {
        matches = await searchByAppProperty({
          parentId: folder.data,
          key: "ccpunDocumentDigest",
          value: digest.data,
          token: accessToken,
          fetchImpl,
        });
      } catch {
        return { ok: false, status: "provider_failed" };
      }
      if (!matches) return { ok: false, status: "provider_failed" };
      if (matches.length > 1) return { ok: false, status: "reconciliation_required" };
      if (matches.length === 1) {
        const permissions = await isOwnerOnlyPrivate(matches[0].id, accessToken, fetchImpl);
        if (permissions === false) return { ok: false, status: "unsafe_permissions" };
        if (permissions === null) return { ok: false, status: "provider_failed" };
        return { ok: true, status: "already_stored", externalFileId: matches[0].id };
      }

      let initiate: Response;
      try {
        initiate = await fetchImpl(
          `${DRIVE_UPLOAD_API}/files?uploadType=resumable&fields=id,mimeType,parents,trashed`,
          {
            method: "POST",
            headers: {
              ...bearer(accessToken, "application/json"),
              "X-Upload-Content-Type": mimeType.data,
              "X-Upload-Content-Length": String(input.body.size),
            },
            body: JSON.stringify({
              name: `CCPun Document ${digest.data.slice(0, 12)}`,
              parents: [folder.data],
              appProperties: { ccpunDocumentDigest: digest.data },
            }),
            redirect: "error",
            signal: AbortSignal.timeout(10_000),
          },
        );
      } catch {
        return { ok: false, status: "reconciliation_required" };
      }
      if (!initiate.ok) {
        await initiate.body?.cancel().catch(() => undefined);
        return { ok: false, status: "provider_failed" };
      }

      const location = initiate.headers.get("location");
      if (!location) return { ok: false, status: "reconciliation_required" };
      let uploadUrl: URL;
      try {
        uploadUrl = new URL(location);
      } catch {
        return { ok: false, status: "reconciliation_required" };
      }
      if (uploadUrl.protocol !== "https:" || uploadUrl.origin !== "https://www.googleapis.com") {
        return { ok: false, status: "reconciliation_required" };
      }

      let uploaded: Response;
      try {
        uploaded = await fetchImpl(uploadUrl.toString(), {
          method: "PUT",
          headers: {
            "Content-Type": mimeType.data,
            "Content-Length": String(input.body.size),
          },
          body: input.body,
          redirect: "error",
          signal: AbortSignal.timeout(60_000),
        });
      } catch {
        return { ok: false, status: "reconciliation_required" };
      }
      if (!uploaded.ok) {
        await uploaded.body?.cancel().catch(() => undefined);
        return { ok: false, status: uploaded.status >= 500 ? "reconciliation_required" : "provider_failed" };
      }
      const file = parseFile(await uploaded.json());
      if (!file) return { ok: false, status: "reconciliation_required" };
      const permissions = await isOwnerOnlyPrivate(file.id, accessToken, fetchImpl);
      if (permissions === false) return { ok: false, status: "unsafe_permissions" };
      if (permissions === null) return { ok: false, status: "provider_failed" };
      return { ok: true, status: "stored", externalFileId: file.id };
    },

    async deleteDocument(externalFileId) {
      const fileId = googleDriveFileIdSchema.safeParse(externalFileId);
      if (!fileId.success) return { ok: false, status: "provider_failed" };
      let response: Response;
      try {
        response = await fetchImpl(driveUrl(`/files/${encodeURIComponent(fileId.data)}`), {
          method: "DELETE",
          headers: bearer(accessToken),
          redirect: "error",
          signal: AbortSignal.timeout(15_000),
        });
      } catch {
        return { ok: false, status: "reconciliation_required" };
      }
      if (response.status === 204) return { ok: true, status: "deleted" };
      if (response.status === 404) return { ok: true, status: "already_absent" };
      await response.body?.cancel().catch(() => undefined);
      return { ok: false, status: response.status >= 500 ? "reconciliation_required" : "provider_failed" };
    },
  };
}
