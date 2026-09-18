if (typeof window !== "undefined") throw new Error("CCPUN_DOCUMENT_MEDIA_SERVER_ONLY");

import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { z } from "zod";
import {
  adminOperationsRuntimeInputFromEnvironment,
  resolveAdminOperationsRuntimeIdentity,
} from "../operations/foundation";
import {
  createLineContentCrypto,
  isLinePrivateKeyUnavailableError,
  isLinePrivateKeyVersion,
  type LineEncryptedValue,
} from "../../line/private-crypto";

const healthRowSchema = z.object({
  web_runtime_active_v2: z.boolean(),
  web_runtime_v1_key_present: z.boolean(),
  web_runtime_v2_key_present: z.boolean(),
  web_runtime_lazy_rotation_enabled: z.boolean(),
  web_runtime_last_reported_at: z.union([z.string(), z.date()]).nullable(),
  drive_folder_ready: z.coerce.number().int().nonnegative(),
  drive_folder_unsafe: z.coerce.number().int().nonnegative(),
  document_pending_fetch: z.coerce.number().int().nonnegative(),
  document_pending_upload: z.coerce.number().int().nonnegative(),
  document_stored: z.coerce.number().int().nonnegative(),
  document_failed: z.coerce.number().int().nonnegative(),
  document_revoke_required: z.coerce.number().int().nonnegative(),
  document_reconciliation: z.coerce.number().int().nonnegative(),
});

const fetchSourceSchema = z.object({
  provider_message_ciphertext_b64: z.string().min(1),
  provider_message_nonce_b64: z.string().min(1),
  provider_message_auth_tag_b64: z.string().min(1),
  provider_message_key_version: z.coerce.number().int().positive(),
  message_type: z.string().min(1).max(80),
});

const uploadPreparationSchema = z.object({
  outcome: z.enum(["ready", "already_stored", "drive_authorization_required"]),
  external_folder_id: z.string().nullable(),
  upload_idempotency_digest: z.string().regex(/^[0-9a-f]{64}$/),
});

const storageTargetSchema = z.object({
  external_file_id: z.string().nullable(),
  external_folder_id: z.string().nullable(),
  upload_idempotency_digest: z.string().regex(/^[0-9a-f]{64}$/).nullable(),
  storage_status: z.enum([
    "pending_fetch",
    "pending_upload",
    "stored",
    "revoke_required",
    "revoked",
    "deleted",
    "failed",
    "reconciliation_required",
  ]),
});

function iso(value: string | Date | null) {
  return value instanceof Date ? value.toISOString() : value;
}

function digest(namespace: string, value: string) {
  return createHash("sha256").update(namespace).update("\0").update(value).digest("hex");
}

async function adminSql(variables: Record<string, string | undefined> = process.env) {
  const runtime = resolveAdminOperationsRuntimeIdentity(adminOperationsRuntimeInputFromEnvironment(variables));
  const connectionString = variables.CCPUN_ADMIN_DATABASE_URL?.trim();
  if (!runtime || !connectionString) return null;
  return neon(connectionString, { fetchOptions: { signal: AbortSignal.timeout(5_000) } });
}

export function getLineProviderActivationReadiness(
  variables: Record<string, string | undefined> = process.env,
) {
  let activeV2 = false;
  let v2Configured = false;
  try {
    const crypto = createLineContentCrypto(variables);
    activeV2 = crypto.keyVersion === 2;
    v2Configured = crypto.hasKeyVersion(2);
  } catch {
    activeV2 = false;
    v2Configured = false;
  }
  const channelTokenPresent = Boolean(variables.CCPUN_LINE_CHANNEL_ACCESS_TOKEN?.trim());
  return {
    activeV2,
    v2Configured,
    channelTokenPresent,
    outboundWriteGateEnabled: variables.CCPUN_LINE_OUTBOUND_ENABLED?.trim() === "true",
    richMenuWriteGateEnabled: variables.CCPUN_LINE_RICH_MENU_PROVIDER_ENABLED?.trim() === "true",
    driveAuthorizationMode: "owner-interactive" as const,
    driveScope: "drive.file" as const,
    drivePersistentCredentialConfigured: false,
  };
}

export async function readLineDocumentMediaHealth(
  variables: Record<string, string | undefined> = process.env,
) {
  const sql = await adminSql(variables);
  if (!sql) return { state: "not_ready" as const };
  try {
    const row = healthRowSchema.array().parse(await sql.query(
      "SELECT * FROM private_line.admin_read_document_media_health()",
      [],
    ))[0];
    if (!row) return { state: "unavailable" as const };
    return {
      state: "ready" as const,
      webRuntimeActiveV2: row.web_runtime_active_v2,
      webRuntimeV1KeyPresent: row.web_runtime_v1_key_present,
      webRuntimeV2KeyPresent: row.web_runtime_v2_key_present,
      webRuntimeLazyRotationEnabled: row.web_runtime_lazy_rotation_enabled,
      webRuntimeLastReportedAt: iso(row.web_runtime_last_reported_at),
      driveFolderReady: row.drive_folder_ready,
      driveFolderUnsafe: row.drive_folder_unsafe,
      pendingFetch: row.document_pending_fetch,
      pendingUpload: row.document_pending_upload,
      stored: row.document_stored,
      failed: row.document_failed,
      revokeRequired: row.document_revoke_required,
      reconciliationRequired: row.document_reconciliation,
    };
  } catch {
    return { state: "unavailable" as const };
  }
}

export function documentUploadIdempotencyDigest(documentId: string) {
  const parsed = z.string().uuid().safeParse(documentId);
  if (!parsed.success) throw new Error("LINE_DOCUMENT_ID_INVALID");
  return digest("ccpun-line-document-upload-v1", parsed.data);
}

export function driveObjectIdentityDigest(externalId: string) {
  const normalized = externalId.trim();
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(normalized)) throw new Error("DRIVE_OBJECT_ID_INVALID");
  return digest("ccpun-drive-object-v1", normalized);
}

export async function registerCustomerDriveFolder(input: {
  customerId: string;
  externalFolderId: string;
}, variables: Record<string, string | undefined> = process.env) {
  if (!z.string().uuid().safeParse(input.customerId).success || !/^[A-Za-z0-9_-]{10,200}$/.test(input.externalFolderId)) {
    throw new Error("LINE_DRIVE_FOLDER_INVALID");
  }
  const sql = await adminSql(variables);
  if (!sql) throw new Error("LINE_ADMIN_RUNTIME_NOT_READY");
  const rows = await sql.query(
    "SELECT outcome FROM private_line.admin_register_customer_drive_folder($1::jsonb)",
    [JSON.stringify({
      customer_id: input.customerId,
      external_folder_id: input.externalFolderId,
      folder_id_digest: driveObjectIdentityDigest(input.externalFolderId),
      permission_state: "private",
    })],
  ) as Array<{ outcome?: unknown }>;
  if (rows[0]?.outcome !== "ready") throw new Error("LINE_DRIVE_FOLDER_REGISTER_FAILED");
  return { outcome: "ready" as const };
}

export async function readDocumentFetchSource(
  documentId: string,
  variables: Record<string, string | undefined> = process.env,
) {
  if (!z.string().uuid().safeParse(documentId).success) throw new Error("LINE_DOCUMENT_ID_INVALID");
  const sql = await adminSql(variables);
  if (!sql) return { state: "not_ready" as const };
  const rows = fetchSourceSchema.array().parse(await sql.query(
    "SELECT provider_message_ciphertext_b64,provider_message_nonce_b64,provider_message_auth_tag_b64,provider_message_key_version,message_type FROM private_line.admin_read_document_fetch_source($1::uuid)",
    [documentId],
  ));
  const row = rows[0];
  if (!row) return { state: "unavailable" as const };
  if (!isLinePrivateKeyVersion(row.provider_message_key_version)) return { state: "unsupported_key_version" as const };
  const encrypted: LineEncryptedValue = {
    ciphertextB64: row.provider_message_ciphertext_b64,
    nonceB64: row.provider_message_nonce_b64,
    authTagB64: row.provider_message_auth_tag_b64,
    keyVersion: row.provider_message_key_version,
  };
  try {
    const crypto = createLineContentCrypto(variables);
    return {
      state: "ready" as const,
      providerMessageId: crypto.decrypt(encrypted, "message-provider-id"),
      messageType: row.message_type,
    };
  } catch (error) {
    return isLinePrivateKeyUnavailableError(error)
      ? { state: "key_unavailable" as const }
      : { state: "decrypt_failed" as const };
  }
}

export async function checkpointDocumentFetch(input: {
  documentId: string;
  result: "ready_for_upload" | "failed" | "reconciliation_required";
  errorClass?: string | null;
  providerStatusCode?: number | null;
}, variables: Record<string, string | undefined> = process.env) {
  if (!z.string().uuid().safeParse(input.documentId).success) throw new Error("LINE_DOCUMENT_ID_INVALID");
  const sql = await adminSql(variables);
  if (!sql) throw new Error("LINE_ADMIN_RUNTIME_NOT_READY");
  const rows = await sql.query(
    "SELECT outcome FROM private_line.admin_checkpoint_document_fetch($1::jsonb)",
    [JSON.stringify({
      document_id: input.documentId,
      result: input.result,
      error_class: input.errorClass ?? null,
      provider_status_code: input.providerStatusCode ?? null,
    })],
  ) as Array<{ outcome?: unknown }>;
  if (rows[0]?.outcome !== input.result) throw new Error("LINE_DOCUMENT_FETCH_CHECKPOINT_FAILED");
  return { outcome: input.result };
}

export async function prepareDocumentUpload(
  documentId: string,
  variables: Record<string, string | undefined> = process.env,
) {
  const uploadDigest = documentUploadIdempotencyDigest(documentId);
  const sql = await adminSql(variables);
  if (!sql) return { state: "not_ready" as const };
  const row = uploadPreparationSchema.array().parse(await sql.query(
    "SELECT outcome,external_folder_id,upload_idempotency_digest FROM private_line.admin_prepare_document_upload($1::jsonb)",
    [JSON.stringify({ document_id: documentId, upload_idempotency_digest: uploadDigest })],
  ))[0];
  if (!row) return { state: "unavailable" as const };
  if (row.outcome === "drive_authorization_required" || !row.external_folder_id) {
    return { state: "drive_authorization_required" as const };
  }
  return {
    state: row.outcome === "already_stored" ? "already_stored" as const : "ready" as const,
    externalFolderId: row.external_folder_id,
    uploadIdempotencyDigest: row.upload_idempotency_digest,
  };
}

export async function checkpointDocumentUpload(input: {
  documentId: string;
  result: "stored" | "failed" | "reconciliation_required";
  externalFileId?: string | null;
  mimeType?: string | null;
  byteSize?: number | null;
  errorClass?: string | null;
  providerStatusCode?: number | null;
}, variables: Record<string, string | undefined> = process.env) {
  if (!z.string().uuid().safeParse(input.documentId).success) throw new Error("LINE_DOCUMENT_ID_INVALID");
  const externalFileId = input.externalFileId?.trim() || null;
  const sql = await adminSql(variables);
  if (!sql) throw new Error("LINE_ADMIN_RUNTIME_NOT_READY");
  const rows = await sql.query(
    "SELECT outcome FROM private_line.admin_checkpoint_document_upload($1::jsonb)",
    [JSON.stringify({
      document_id: input.documentId,
      result: input.result,
      external_file_id: externalFileId,
      external_file_id_digest: externalFileId ? driveObjectIdentityDigest(externalFileId) : null,
      mime_type: input.mimeType ?? null,
      byte_size: input.byteSize ?? null,
      error_class: input.errorClass ?? null,
      provider_status_code: input.providerStatusCode ?? null,
    })],
  ) as Array<{ outcome?: unknown }>;
  if (rows[0]?.outcome !== input.result) throw new Error("LINE_DOCUMENT_UPLOAD_CHECKPOINT_FAILED");
  return { outcome: input.result };
}

export async function readDocumentStorageTarget(
  documentId: string,
  variables: Record<string, string | undefined> = process.env,
) {
  if (!z.string().uuid().safeParse(documentId).success) throw new Error("LINE_DOCUMENT_ID_INVALID");
  const sql = await adminSql(variables);
  if (!sql) return { state: "not_ready" as const };
  const row = storageTargetSchema.array().parse(await sql.query(
    "SELECT external_file_id,external_folder_id,upload_idempotency_digest,storage_status FROM private_line.admin_read_document_storage_target($1::uuid)",
    [documentId],
  ))[0];
  if (!row) return { state: "unavailable" as const };
  return {
    state: "ready" as const,
    externalFileId: row.external_file_id,
    externalFolderId: row.external_folder_id,
    uploadIdempotencyDigest: row.upload_idempotency_digest,
    storageStatus: row.storage_status,
  };
}

export async function checkpointDocumentRevoke(input: {
  documentId: string;
  result: "revoked" | "deleted" | "failed" | "reconciliation_required";
  errorClass?: string | null;
  providerStatusCode?: number | null;
}, variables: Record<string, string | undefined> = process.env) {
  if (!z.string().uuid().safeParse(input.documentId).success) throw new Error("LINE_DOCUMENT_ID_INVALID");
  const sql = await adminSql(variables);
  if (!sql) throw new Error("LINE_ADMIN_RUNTIME_NOT_READY");
  const rows = await sql.query(
    "SELECT outcome FROM private_line.admin_checkpoint_document_revoke($1::jsonb)",
    [JSON.stringify({
      document_id: input.documentId,
      result: input.result,
      error_class: input.errorClass ?? null,
      provider_status_code: input.providerStatusCode ?? null,
    })],
  ) as Array<{ outcome?: unknown }>;
  if (rows[0]?.outcome !== input.result) throw new Error("LINE_DOCUMENT_REVOKE_CHECKPOINT_FAILED");
  return { outcome: input.result };
}
