import "server-only";

import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { z } from "zod";
import {
  adminOperationsRuntimeInputFromEnvironment,
  resolveAdminOperationsRuntimeIdentity,
} from "../operations/foundation";
import {
  createLineContentCrypto,
  isLinePrivateKeyVersion,
  type LineEncryptedValue,
} from "../../line/private-crypto";

const LINE_PROFILE_API = "https://api.line.me/v2/bot/profile";

const profileSourceSchema = z.object({
  identity_id: z.string().uuid(),
  external_ref_ciphertext_b64: z.string(),
  external_ref_nonce_b64: z.string(),
  external_ref_auth_tag_b64: z.string(),
  external_ref_key_version: z.coerce.number().int().positive(),
  display_name_ciphertext_b64: z.string().nullable(),
  display_name_nonce_b64: z.string().nullable(),
  display_name_auth_tag_b64: z.string().nullable(),
  display_name_key_version: z.coerce.number().int().positive().nullable(),
  picture_url_ciphertext_b64: z.string().nullable(),
  picture_url_nonce_b64: z.string().nullable(),
  picture_url_auth_tag_b64: z.string().nullable(),
  picture_url_key_version: z.coerce.number().int().positive().nullable(),
  profile_fetched_at: z.union([z.string(), z.date()]).nullable(),
});

const archiveRowSchema = z.object({
  archive_message_id: z.string().uuid(),
  source_kind: z.enum(["line_webhook", "line_oa_csv", "manual_ocr"]),
  direction: z.enum(["inbound", "outbound"]),
  message_type: z.string().max(32),
  status: z.enum(["active", "unsent", "imported"]),
  occurred_at: z.union([z.string(), z.date()]),
  unsent_at: z.union([z.string(), z.date()]).nullable(),
  content_ciphertext_b64: z.string().nullable(),
  content_nonce_b64: z.string().nullable(),
  content_auth_tag_b64: z.string().nullable(),
  content_key_version: z.coerce.number().int().positive().nullable(),
  content_purpose: z.enum(["message-content", "line-oa-import-content", "chat-ocr-import-content"]).nullable(),
});

function iso(value: string | Date | null | undefined) {
  return value instanceof Date ? value.toISOString() : value ?? null;
}

async function adminSql(variables: Record<string, string | undefined> = process.env) {
  const runtime = resolveAdminOperationsRuntimeIdentity(adminOperationsRuntimeInputFromEnvironment(variables));
  const connectionString = variables.CCPUN_ADMIN_DATABASE_URL?.trim();
  if (!runtime || !connectionString) return null;
  return neon(connectionString, { fetchOptions: { signal: AbortSignal.timeout(5_000) } });
}

function encrypted(row: {
  ciphertext: string;
  nonce: string;
  tag: string;
  version: number;
}): LineEncryptedValue | null {
  if (!isLinePrivateKeyVersion(row.version)) return null;
  return {
    keyVersion: row.version,
    ciphertextB64: row.ciphertext,
    nonceB64: row.nonce,
    authTagB64: row.tag,
  };
}

export type LinePrivateProfile = {
  displayName: string;
  pictureUrl: string | null;
  fetchedAt: string;
  source: "cache" | "line";
};

function decryptCachedProfile(
  row: z.infer<typeof profileSourceSchema>,
  variables: Record<string, string | undefined>,
): LinePrivateProfile | null {
  if (!row.display_name_ciphertext_b64 || !row.display_name_nonce_b64 || !row.display_name_auth_tag_b64 || !row.display_name_key_version || !row.profile_fetched_at) return null;
  try {
    const crypto = createLineContentCrypto(variables);
    const nameEncrypted = encrypted({
      ciphertext: row.display_name_ciphertext_b64,
      nonce: row.display_name_nonce_b64,
      tag: row.display_name_auth_tag_b64,
      version: row.display_name_key_version,
    });
    if (!nameEncrypted) return null;
    const displayName = crypto.decrypt(nameEncrypted, "line-profile-display-name");
    let pictureUrl: string | null = null;
    if (row.picture_url_ciphertext_b64 && row.picture_url_nonce_b64 && row.picture_url_auth_tag_b64 && row.picture_url_key_version) {
      const pictureEncrypted = encrypted({
        ciphertext: row.picture_url_ciphertext_b64,
        nonce: row.picture_url_nonce_b64,
        tag: row.picture_url_auth_tag_b64,
        version: row.picture_url_key_version,
      });
      if (pictureEncrypted) pictureUrl = crypto.decrypt(pictureEncrypted, "line-profile-picture-url");
    }
    return { displayName, pictureUrl, fetchedAt: iso(row.profile_fetched_at) ?? "", source: "cache" };
  } catch {
    return null;
  }
}

export async function getLinePrivateProfile(
  leadId: string,
  variables: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<LinePrivateProfile | null> {
  if (!z.string().uuid().safeParse(leadId).success) return null;
  const sql = await adminSql(variables);
  if (!sql) return null;

  let row: z.infer<typeof profileSourceSchema> | undefined;
  try {
    row = profileSourceSchema.array().parse(await sql.query(
      "SELECT * FROM private_line.admin_read_line_profile_source($1::uuid)",
      [leadId],
    ))[0];
  } catch {
    return null;
  }
  if (!row) return null;

  const cached = decryptCachedProfile(row, variables);
  const fetchedAt = cached?.fetchedAt ? new Date(cached.fetchedAt).getTime() : 0;
  if (cached && Number.isFinite(fetchedAt) && Date.now() - fetchedAt < 24 * 60 * 60 * 1000) return cached;

  const token = variables.CCPUN_LINE_CHANNEL_ACCESS_TOKEN?.trim();
  if (!token) return cached;

  try {
    const crypto = createLineContentCrypto(variables);
    const idEncrypted = encrypted({
      ciphertext: row.external_ref_ciphertext_b64,
      nonce: row.external_ref_nonce_b64,
      tag: row.external_ref_auth_tag_b64,
      version: row.external_ref_key_version,
    });
    if (!idEncrypted) return cached;
    const userId = crypto.decrypt(idEncrypted, "line-user-id");
    const response = await fetchImpl(`${LINE_PROFILE_API}/${encodeURIComponent(userId)}`, {
      method: "GET",
      redirect: "error",
      signal: AbortSignal.timeout(7_000),
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return cached;
    const data = await response.json() as { displayName?: unknown; pictureUrl?: unknown };
    const displayName = typeof data.displayName === "string" ? data.displayName.trim().slice(0, 200) : "";
    const pictureUrl = typeof data.pictureUrl === "string" && /^https:\/\//.test(data.pictureUrl) ? data.pictureUrl.slice(0, 2000) : null;
    if (!displayName) return cached;

    const nameEncrypted = crypto.encrypt(displayName, "line-profile-display-name");
    const pictureEncrypted = pictureUrl ? crypto.encrypt(pictureUrl, "line-profile-picture-url") : null;
    const now = new Date().toISOString();
    await sql.query(
      "SELECT outcome FROM private_line.admin_checkpoint_line_profile($1::jsonb)",
      [JSON.stringify({
        lead_id: leadId,
        display_name_ciphertext_b64: nameEncrypted.ciphertextB64,
        display_name_nonce_b64: nameEncrypted.nonceB64,
        display_name_auth_tag_b64: nameEncrypted.authTagB64,
        display_name_key_version: nameEncrypted.keyVersion,
        picture_url_ciphertext_b64: pictureEncrypted?.ciphertextB64 ?? null,
        picture_url_nonce_b64: pictureEncrypted?.nonceB64 ?? null,
        picture_url_auth_tag_b64: pictureEncrypted?.authTagB64 ?? null,
        picture_url_key_version: pictureEncrypted?.keyVersion ?? null,
        fetched_at: now,
      })],
    );
    return { displayName, pictureUrl, fetchedAt: now, source: "line" };
  } catch {
    return cached;
  }
}

export async function getLinePrivateProfiles(
  leadIds: readonly string[],
  variables: Record<string, string | undefined> = process.env,
) {
  const unique = Array.from(new Set(leadIds.filter((id) => z.string().uuid().safeParse(id).success))).slice(0, 20);
  const pairs = await Promise.all(unique.map(async (leadId) => [leadId, await getLinePrivateProfile(leadId, variables)] as const));
  return new Map(pairs);
}

export type LineEvidenceItem = {
  id: string;
  sourceKind: "line_webhook" | "line_oa_csv" | "manual_ocr";
  direction: "inbound" | "outbound";
  messageType: string;
  status: "active" | "unsent" | "imported";
  occurredAt: string;
  unsentAt: string | null;
  text: string | null;
  contentState: "available" | "not_available" | "decrypt_failed";
  fingerprint: string;
};

export async function readLineConversationEvidence(
  leadId: string,
  variables: Record<string, string | undefined> = process.env,
): Promise<LineEvidenceItem[]> {
  if (!z.string().uuid().safeParse(leadId).success) return [];
  const sql = await adminSql(variables);
  if (!sql) return [];
  const crypto = (() => { try { return createLineContentCrypto(variables); } catch { return null; } })();
  if (!crypto) return [];
  let rows: z.infer<typeof archiveRowSchema>[];
  try {
    rows = archiveRowSchema.array().parse(await sql.query(
      "SELECT * FROM private_line.admin_read_line_archive($1::uuid,$2::integer)",
      [leadId, 500],
    ));
  } catch {
    return [];
  }
  return rows.map((row) => {
    let text: string | null = null;
    let contentState: LineEvidenceItem["contentState"] = "not_available";
    if (row.content_ciphertext_b64 && row.content_nonce_b64 && row.content_auth_tag_b64 && row.content_key_version && row.content_purpose && isLinePrivateKeyVersion(row.content_key_version)) {
      try {
        text = crypto.decrypt({
          keyVersion: row.content_key_version,
          ciphertextB64: row.content_ciphertext_b64,
          nonceB64: row.content_nonce_b64,
          authTagB64: row.content_auth_tag_b64,
        }, row.content_purpose);
        contentState = "available";
      } catch {
        contentState = "decrypt_failed";
      }
    }
    const occurredAt = iso(row.occurred_at) ?? "";
    const unsentAt = iso(row.unsent_at);
    const fingerprint = createHash("sha256")
      .update(["ccpun-line-evidence-v1", row.direction, row.message_type, occurredAt, unsentAt ?? "", text ?? ""].join("\0"))
      .digest("hex");
    return {
      id: row.archive_message_id,
      sourceKind: row.source_kind,
      direction: row.direction,
      messageType: row.message_type,
      status: row.status,
      occurredAt,
      unsentAt,
      text,
      contentState,
      fingerprint,
    };
  });
}

function actorDigest(actor: string) {
  return createHash("sha256").update("ccpun-admin-actor-v1\0").update(actor).digest("hex");
}

export async function recordLineEvidenceAccess(
  input: { leadId: string; actor: string; action: "view" | "print"; itemCount: number },
  variables: Record<string, string | undefined> = process.env,
) {
  const sql = await adminSql(variables);
  if (!sql) throw new Error("LINE_ARCHIVE_RUNTIME_NOT_READY");
  const rows = await sql.query(
    "SELECT outcome FROM private_line.admin_record_line_evidence_access($1::jsonb)",
    [JSON.stringify({
      lead_id: input.leadId,
      actor_digest: actorDigest(input.actor),
      action: input.action,
      item_count: Math.max(0, Math.min(500, Math.floor(input.itemCount))),
    })],
  ) as Array<{ outcome?: unknown }>;
  if (rows[0]?.outcome !== "recorded") throw new Error("LINE_EVIDENCE_AUDIT_FAILED");
}

function parseCsvRows(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < csv.length; i += 1) {
    const c = csv[i];
    if (quoted) {
      if (c === '"' && csv[i + 1] === '"') { field += '"'; i += 1; continue; }
      if (c === '"') { quoted = false; continue; }
      field += c;
      continue;
    }
    if (c === '"') { quoted = true; continue; }
    if (c === ",") { row.push(field); field = ""; continue; }
    if (c === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; continue; }
    field += c;
  }
  row.push(field.replace(/\r$/, ""));
  if (row.some((cell) => cell.length)) rows.push(row);
  return rows;
}

function normalizedHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s_.-]+/g, "");
}

function findHeaderIndex(headers: string[], aliases: readonly string[]) {
  const normalized = headers.map(normalizedHeader);
  return normalized.findIndex((header) => aliases.map(normalizedHeader).includes(header));
}

function parseBangkokDate(value: string): Date | null {
  const trimmed = value.trim();
  const m = trimmed.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (m) {
    const [, y, mo, d, h, mi, s = "00"] = m;
    const isoValue = `${y}-${mo.padStart(2,"0")}-${d.padStart(2,"0")}T${h.padStart(2,"0")}:${mi}:${s}+07:00`;
    const date = new Date(isoValue);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function importLineOAChatCsv(
  input: { leadId: string; csv: string; ccpunSenderLabel: string },
  variables: Record<string, string | undefined> = process.env,
) {
  if (!z.string().uuid().safeParse(input.leadId).success) throw new Error("LINE_OA_IMPORT_INVALID");
  const label = input.ccpunSenderLabel.trim().toLowerCase();
  if (!label || label.length > 200) throw new Error("LINE_OA_IMPORT_SENDER_LABEL_INVALID");
  const rows = parseCsvRows(input.csv);
  if (rows.length < 2) throw new Error("LINE_OA_IMPORT_EMPTY");
  const headers = rows[0];
  const timeIndex = findHeaderIndex(headers, ["timestamp","datetime","date time","time","date","วันเวลา","วันที่","เวลา"]);
  const senderIndex = findHeaderIndex(headers, ["sender","from","user","name","ผู้ส่ง","ชื่อผู้ส่ง","ชื่อ"]);
  const textIndex = findHeaderIndex(headers, ["message","text","content","ข้อความ","เนื้อหา"]);
  if (timeIndex < 0 || senderIndex < 0 || textIndex < 0) throw new Error("LINE_OA_IMPORT_UNSUPPORTED_FORMAT");

  const sql = await adminSql(variables);
  if (!sql) throw new Error("LINE_ARCHIVE_RUNTIME_NOT_READY");
  const crypto = createLineContentCrypto(variables);
  let imported = 0;
  let duplicate = 0;
  let skipped = 0;

  for (const row of rows.slice(1, 5001)) {
    if ((row[senderIndex] ?? "").trim().toLowerCase() !== label) { skipped += 1; continue; }
    const text = (row[textIndex] ?? "").trim();
    const occurredAt = parseBangkokDate(row[timeIndex] ?? "");
    if (!text || text.length > 5000 || !occurredAt) { skipped += 1; continue; }
    const occurredIso = occurredAt.toISOString();
    const sourceDigest = createHash("sha256")
      .update(["line-oa-csv-v1", input.leadId, occurredIso, text].join("\0"))
      .digest("hex");
    const enc = crypto.encrypt(text, "line-oa-import-content");
    const result = await sql.query(
      "SELECT outcome FROM private_line.admin_import_line_oa_archive_message($1::jsonb)",
      [JSON.stringify({
        lead_id: input.leadId,
        source_digest: sourceDigest,
        occurred_at: occurredIso,
        content_ciphertext_b64: enc.ciphertextB64,
        content_nonce_b64: enc.nonceB64,
        content_auth_tag_b64: enc.authTagB64,
        content_key_version: enc.keyVersion,
      })],
    ) as Array<{ outcome?: unknown }>;
    if (result[0]?.outcome === "imported") imported += 1;
    else if (result[0]?.outcome === "duplicate") duplicate += 1;
    else skipped += 1;
  }
  return { imported, duplicate, skipped };
}


export async function importChatOcrMessages(
  input: {
    leadId: string;
    requestId: string;
    messages: Array<{
      direction: "inbound" | "outbound";
      text: string;
      occurredAt: string;
    }>;
  },
  variables: Record<string, string | undefined> = process.env,
) {
  if (!z.string().uuid().safeParse(input.leadId).success) throw new Error("CHAT_OCR_IMPORT_INVALID_LEAD");
  if (!/^[A-Za-z0-9._:-]{8,160}$/.test(input.requestId)) throw new Error("CHAT_OCR_IMPORT_INVALID_REQUEST");
  if (!Array.isArray(input.messages) || input.messages.length < 1 || input.messages.length > 200) {
    throw new Error("CHAT_OCR_IMPORT_INVALID_MESSAGES");
  }

  const sql = await adminSql(variables);
  if (!sql) throw new Error("LINE_ARCHIVE_RUNTIME_NOT_READY");
  const crypto = createLineContentCrypto(variables);

  let imported = 0;
  let duplicate = 0;

  for (let index = 0; index < input.messages.length; index += 1) {
    const message = input.messages[index]!;
    const text = message.text.trim();
    const occurredAt = new Date(message.occurredAt);
    if (
      !["inbound", "outbound"].includes(message.direction)
      || !text
      || text.length > 5000
      || Number.isNaN(occurredAt.getTime())
    ) {
      throw new Error("CHAT_OCR_IMPORT_INVALID_MESSAGE");
    }

    const occurredIso = occurredAt.toISOString();
    const sourceDigest = createHash("sha256")
      .update([
        "ccpun-chat-ocr-v1",
        input.leadId,
        input.requestId,
        String(index),
        message.direction,
        occurredIso,
        text,
      ].join("\0"))
      .digest("hex");
    const enc = crypto.encrypt(text, "chat-ocr-import-content");

    const rows = await sql.query(
      "SELECT outcome FROM private_line.admin_import_chat_ocr_archive_message($1::jsonb)",
      [JSON.stringify({
        lead_id: input.leadId,
        source_digest: sourceDigest,
        direction: message.direction,
        occurred_at: occurredIso,
        content_ciphertext_b64: enc.ciphertextB64,
        content_nonce_b64: enc.nonceB64,
        content_auth_tag_b64: enc.authTagB64,
        content_key_version: enc.keyVersion,
      })],
    ) as Array<{ outcome?: unknown }>;

    if (rows[0]?.outcome === "imported") imported += 1;
    else if (rows[0]?.outcome === "duplicate") duplicate += 1;
    else throw new Error("CHAT_OCR_IMPORT_FAILED");
  }

  return { imported, duplicate, total: input.messages.length };
}

const archiveHealthSchema = z.object({
  archived_message_count: z.coerce.number().int().nonnegative(),
  retained_unsent_count: z.coerce.number().int().nonnegative(),
  imported_outbound_count: z.coerce.number().int().nonnegative(),
  cached_profile_count: z.coerce.number().int().nonnegative(),
  evidence_access_count: z.coerce.number().int().nonnegative(),
  direct_admin_reply_enabled: z.boolean(),
});

export async function readLineArchiveHealth(
  variables: Record<string, string | undefined> = process.env,
) {
  const sql = await adminSql(variables);
  if (!sql) return { state: "not_ready" as const };
  try {
    const row = archiveHealthSchema.array().parse(await sql.query(
      "SELECT * FROM private_line.admin_read_line_archive_health()",
      [],
    ))[0];
    if (!row) return { state: "unavailable" as const };
    return {
      state: "ready" as const,
      archivedMessageCount: row.archived_message_count,
      retainedUnsentCount: row.retained_unsent_count,
      importedOutboundCount: row.imported_outbound_count,
      cachedProfileCount: row.cached_profile_count,
      evidenceAccessCount: row.evidence_access_count,
      directAdminReplyEnabled: row.direct_admin_reply_enabled,
    };
  } catch {
    return { state: "unavailable" as const };
  }
}
