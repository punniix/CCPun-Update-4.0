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
  isLinePrivateKeyUnavailableError,
  isLinePrivateKeyVersion,
  type LineEncryptedValue,
} from "../../line/private-crypto";
import { LINE_CASE_STAGES, type LineCaseStage } from "../../line/ecosystem";

const filterSchema = z.object({
  stage: z.enum(LINE_CASE_STAGES).optional(),
  journey: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,79}$/).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  assignedAdvisor: z.string().trim().min(1).max(200).optional(),
  caseState: z.enum(["active", "waiting", "completed"]).optional(),
  tag: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,79}$/).optional(),
  q: z.string().regex(/^[a-z0-9_.:-]{1,80}$/).optional(),
}).strict();

export type AdvisorInboxFilters = z.infer<typeof filterSchema>;

const rowSchema = z.object({
  lead_id: z.string().uuid(),
  advisor_case_id: z.string().uuid().nullable(),
  customer_code: z.string().regex(/^C[0-9A-F]{32}$/),
  stage: z.enum(LINE_CASE_STAGES),
  journey: z.string(),
  material_received: z.boolean(),
  conversation_status: z.string(),
  unread_count: z.coerce.number().int().nonnegative(),
  last_activity_at: z.union([z.string(), z.date()]).nullable(),
  priority: z.enum(["low", "normal", "high", "urgent"]).nullable(),
  assigned_advisor: z.string().nullable(),
  follow_up_at: z.union([z.string(), z.date()]).nullable(),
  case_state: z.enum(["active", "waiting", "completed"]),
  tags: z.array(z.string()),
  latest_message_type: z.string().nullable(),
  latest_message_status: z.string().nullable(),
  latest_message_needs_human: z.boolean().nullable(),
  updated_at: z.union([z.string(), z.date()]),
  origin: z.string().nullable(),
  campaign_id: z.string().nullable(),
  content_id: z.string().nullable(),
  need: z.string().nullable(),
  tool_id: z.string().nullable(),
  saved_result_ref: z.string().nullable(),
});

const timelineSchema = z.object({
  event_id: z.string().uuid(),
  event_type: z.enum(["assignment", "follow_up", "priority", "state", "tag_added", "tag_removed", "note_added", "document_status"]),
  safe_detail: z.record(z.string(), z.unknown()),
  created_at: z.union([z.string(), z.date()]),
});

const documentSchema = z.object({
  document_id: z.string().uuid(),
  document_category: z.string(),
  status: z.string(),
  mime_type: z.string().nullable(),
  byte_size: z.coerce.number().nonnegative().nullable(),
  created_at: z.union([z.string(), z.date()]),
  updated_at: z.union([z.string(), z.date()]),
});

const noteRowSchema = z.object({
  note_id: z.string().uuid(),
  content_ciphertext_b64: z.string(),
  content_nonce_b64: z.string(),
  content_auth_tag_b64: z.string(),
  content_key_version: z.coerce.number().int().positive(),
  created_at: z.union([z.string(), z.date()]),
});

function iso(value: string | Date | null) {
  return value instanceof Date ? value.toISOString() : value;
}

function actorDigest(actor: string) {
  return createHash("sha256").update("ccpun-admin-actor-v1\0").update(actor).digest("hex");
}

async function adminSql(variables: Record<string, string | undefined> = process.env) {
  const runtime = resolveAdminOperationsRuntimeIdentity(adminOperationsRuntimeInputFromEnvironment(variables));
  const connectionString = variables.CCPUN_ADMIN_DATABASE_URL?.trim();
  if (!runtime || !connectionString) return null;
  return neon(connectionString, { fetchOptions: { signal: AbortSignal.timeout(5_000) } });
}

export async function listAdvisorInboxOperational(
  input: AdvisorInboxFilters,
  variables: Record<string, string | undefined> = process.env,
) {
  const parsed = filterSchema.safeParse(input);
  if (!parsed.success) throw new Error("ADVISOR_FILTER_INVALID");
  const sql = await adminSql(variables);
  if (!sql) throw new Error("ADVISOR_RUNTIME_NOT_READY");
  const payload = {
    ...(parsed.data.stage ? { stage: parsed.data.stage } : {}),
    ...(parsed.data.journey ? { journey: parsed.data.journey } : {}),
    ...(parsed.data.priority ? { priority: parsed.data.priority } : {}),
    ...(parsed.data.assignedAdvisor ? { assigned_advisor: parsed.data.assignedAdvisor } : {}),
    ...(parsed.data.caseState ? { case_state: parsed.data.caseState } : {}),
    ...(parsed.data.tag ? { tag: parsed.data.tag } : {}),
    ...(parsed.data.q ? { q: parsed.data.q } : {}),
  };
  const rows = z.array(rowSchema).parse(await sql.query(
    `SELECT lead_id::text, advisor_case_id::text, customer_code, stage, journey, material_received,
            conversation_status, unread_count, last_activity_at, priority, assigned_advisor, follow_up_at,
            case_state, tags, latest_message_type, latest_message_status, latest_message_needs_human,
            updated_at, origin, campaign_id, content_id, need, tool_id, saved_result_ref
     FROM private_line.admin_read_advisor_inbox_filtered($1::jsonb,$2::integer)`,
    [JSON.stringify(payload), 100],
  ));
  return rows.map((row) => ({
    leadId: row.lead_id,
    advisorCaseId: row.advisor_case_id,
    customerCode: row.customer_code,
    stage: row.stage as LineCaseStage,
    journey: row.journey,
    materialReceived: row.material_received,
    conversationStatus: row.conversation_status,
    unreadCount: row.unread_count,
    lastActivityAt: iso(row.last_activity_at),
    priority: row.priority,
    assignedAdvisor: row.assigned_advisor,
    followUpAt: iso(row.follow_up_at),
    caseState: row.case_state,
    tags: row.tags,
    latestMessageType: row.latest_message_type,
    latestMessageStatus: row.latest_message_status,
    latestMessageNeedsHuman: row.latest_message_needs_human,
    updatedAt: iso(row.updated_at) ?? "",
    origin: row.origin,
    campaignId: row.campaign_id,
    contentId: row.content_id,
    need: row.need,
    toolId: row.tool_id,
    savedResultRef: row.saved_result_ref,
  }));
}

export async function updateAdvisorCaseOperations(input: {
  leadId: string;
  actor: string;
  assignedAdvisor?: string | null;
  priority?: "low" | "normal" | "high" | "urgent";
  followUpAt?: string | null;
  caseState?: "active" | "waiting" | "completed";
  tagAdd?: string;
  tagRemove?: string;
}, variables: Record<string, string | undefined> = process.env) {
  if (!z.string().uuid().safeParse(input.leadId).success) throw new Error("ADVISOR_CASE_INVALID");
  const sql = await adminSql(variables);
  if (!sql) throw new Error("ADVISOR_RUNTIME_NOT_READY");
  const payload = {
    lead_id: input.leadId,
    actor_digest: actorDigest(input.actor),
    ...(input.assignedAdvisor !== undefined ? { assigned_advisor: input.assignedAdvisor ?? "" } : {}),
    ...(input.priority ? { priority: input.priority } : {}),
    ...(input.followUpAt !== undefined ? { follow_up_at: input.followUpAt ?? "" } : {}),
    ...(input.caseState ? { case_state: input.caseState } : {}),
    ...(input.tagAdd ? { tag_add: input.tagAdd } : {}),
    ...(input.tagRemove ? { tag_remove: input.tagRemove } : {}),
  };
  const rows = await sql.query(`SELECT outcome FROM private_line.admin_update_case_operations($1::jsonb)`, [JSON.stringify(payload)]) as Array<{ outcome?: unknown }>;
  if (rows[0]?.outcome !== "updated") throw new Error("ADVISOR_CASE_UPDATE_FAILED");
  return { outcome: "updated" as const };
}

export async function readAdvisorCaseTimeline(leadId: string, variables: Record<string, string | undefined> = process.env) {
  if (!z.string().uuid().safeParse(leadId).success) throw new Error("ADVISOR_CASE_INVALID");
  const sql = await adminSql(variables);
  if (!sql) throw new Error("ADVISOR_RUNTIME_NOT_READY");
  const [timeline, documents] = await Promise.all([
    sql.query(`SELECT event_id::text,event_type,safe_detail,created_at FROM private_line.admin_read_case_timeline($1::uuid,$2::integer)`, [leadId, 100]),
    sql.query(`SELECT document_id::text,document_category,status,mime_type,byte_size,created_at,updated_at FROM private_line.advisor_document_safe WHERE lead_id=$1::uuid ORDER BY created_at DESC LIMIT 100`, [leadId]),
  ]);
  return {
    events: z.array(timelineSchema).parse(timeline).map((row) => ({ id: row.event_id, type: row.event_type, detail: row.safe_detail, createdAt: iso(row.created_at) ?? "" })),
    documents: z.array(documentSchema).parse(documents).map((row) => ({ id: row.document_id, category: row.document_category, status: row.status, mimeType: row.mime_type, byteSize: row.byte_size, createdAt: iso(row.created_at) ?? "", updatedAt: iso(row.updated_at) ?? "" })),
  };
}

function noteCrypto(variables: Record<string, string | undefined>) {
  if (variables.CCPUN_LINE_PRIVATE_NOTES_ENABLED?.trim() !== "true") return null;
  try { return createLineContentCrypto(variables); } catch { return null; }
}

export function advisorPrivateNotesEnabled(variables: Record<string, string | undefined> = process.env) {
  return Boolean(noteCrypto(variables));
}

export async function addAdvisorPrivateNote(input: { leadId: string; actor: string; text: string }, variables: Record<string, string | undefined> = process.env) {
  const text = input.text.trim();
  if (!z.string().uuid().safeParse(input.leadId).success || !text || text.length > 4000) throw new Error("ADVISOR_NOTE_INVALID");
  const crypto = noteCrypto(variables);
  if (!crypto) throw new Error("ADVISOR_NOTE_NOT_CONFIGURED");
  const sql = await adminSql(variables);
  if (!sql) throw new Error("ADVISOR_RUNTIME_NOT_READY");
  const encrypted = crypto.encrypt(text, "advisor-private-note");
  const rows = await sql.query(`SELECT outcome,note_id::text FROM private_line.admin_add_private_note($1::jsonb)`, [JSON.stringify({
    lead_id: input.leadId,
    actor_digest: actorDigest(input.actor),
    content_ciphertext_b64: encrypted.ciphertextB64,
    content_nonce_b64: encrypted.nonceB64,
    content_auth_tag_b64: encrypted.authTagB64,
    content_key_version: encrypted.keyVersion,
  })]) as Array<{ outcome?: unknown; note_id?: unknown }>;
  if (rows[0]?.outcome !== "created" || typeof rows[0]?.note_id !== "string") throw new Error("ADVISOR_NOTE_CREATE_FAILED");
  return { outcome: "created" as const, noteId: rows[0].note_id };
}

export async function readAdvisorPrivateNotes(leadId: string, variables: Record<string, string | undefined> = process.env) {
  if (!z.string().uuid().safeParse(leadId).success) throw new Error("ADVISOR_CASE_INVALID");
  const crypto = noteCrypto(variables);
  if (!crypto) return { state: "disabled" as const, notes: [] };
  const sql = await adminSql(variables);
  if (!sql) return { state: "unavailable" as const, notes: [] };
  try {
    const rows = z.array(noteRowSchema).parse(await sql.query(
      `SELECT note_id::text,content_ciphertext_b64,content_nonce_b64,content_auth_tag_b64,content_key_version,created_at
       FROM private_line.admin_read_private_notes($1::uuid,$2::integer)`,
      [leadId, 50],
    ));
    const notes = rows.map((row) => {
      const base = { id: row.note_id, createdAt: iso(row.created_at) ?? "" };
      if (!isLinePrivateKeyVersion(row.content_key_version)) {
        return { ...base, text: null, contentState: "decrypt_failed" as const };
      }
      const encrypted: LineEncryptedValue = {
        keyVersion: row.content_key_version,
        ciphertextB64: row.content_ciphertext_b64,
        nonceB64: row.content_nonce_b64,
        authTagB64: row.content_auth_tag_b64,
      };
      try {
        return {
          ...base,
          text: crypto.decrypt(encrypted, "advisor-private-note"),
          contentState: "available" as const,
        };
      } catch (error) {
        if (isLinePrivateKeyUnavailableError(error)) {
          return { ...base, text: null, contentState: "legacy_key_unavailable" as const };
        }
        return { ...base, text: null, contentState: "decrypt_failed" as const };
      }
    });
    return { state: "available" as const, notes };
  } catch {
    return { state: "unavailable" as const, notes: [] };
  }
}
