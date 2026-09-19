import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { z } from "zod";
import {
  adminOperationsRuntimeInputFromEnvironment,
  resolveAdminOperationsRuntimeIdentity,
  type AdminOperationsLane,
} from "../operations/foundation";
import {
  createLineContentCrypto,
  isLinePrivateKeyUnavailableError,
  isLinePrivateKeyVersion,
  type LineEncryptedValue,
} from "../../line/private-crypto";
import {
  LINE_CASE_STAGES,
  canTransitionLineCaseStage,
  isLineCaseStage,
  nextLineCaseStages,
  routeLineBot,
  type LineCaseStage,
  type LineBotDecision,
} from "../../line/ecosystem";

export const LINE_ADVISOR_INBOX_STAGES = LINE_CASE_STAGES;

const safeInboxRowSchema = z.object({
  lead_id: z.string().uuid(),
  advisor_case_id: z.string().uuid().nullable(),
  customer_code: z.string().regex(/^C[0-9A-F]{32}$/),
  stage: z.enum(LINE_CASE_STAGES),
  journey: z.string().min(1).max(80),
  material_received: z.boolean(),
  conversation_status: z.enum(["open", "closed"]),
  unread_count: z.coerce.number().int().nonnegative(),
  last_activity_at: z.union([z.string(), z.date()]).nullable(),
  priority: z.enum(["low", "normal", "high", "urgent"]).nullable(),
  assigned_advisor: z.string().max(200).nullable(),
  latest_message_type: z.enum(["text", "image", "video", "audio", "file", "location", "sticker"]).nullable(),
  latest_message_status: z.string().max(40).nullable(),
  latest_message_needs_human: z.boolean().nullable(),
  updated_at: z.union([z.string(), z.date()]),
  origin: z.string().max(80).nullable().optional(),
  campaign_id: z.string().max(80).nullable().optional(),
  content_id: z.string().max(80).nullable().optional(),
  need: z.string().max(80).nullable().optional(),
  tool_id: z.string().max(80).nullable().optional(),
  saved_result_ref: z.string().max(80).nullable().optional(),
});

const stageHistorySchema = z.object({
  lead_stage_history_id: z.string().uuid(),
  lead_id: z.string().uuid(),
  from_stage: z.enum(LINE_CASE_STAGES),
  to_stage: z.enum(LINE_CASE_STAGES),
  created_at: z.union([z.string(), z.date()]),
});

const transcriptRowSchema = z.object({
  item_id: z.string().uuid(),
  source_kind: z.enum(["message", "outbound"]),
  direction: z.enum(["inbound", "outbound"]),
  message_type: z.string().max(32),
  status: z.string().max(40),
  needs_human: z.boolean(),
  occurred_at: z.union([z.string(), z.date()]),
  unsent_at: z.union([z.string(), z.date()]).nullable(),
  content_ciphertext_b64: z.string().nullable(),
  content_nonce_b64: z.string().nullable(),
  content_auth_tag_b64: z.string().nullable(),
  content_key_version: z.coerce.number().int().positive().nullable(),
  content_purpose: z.enum(["message-content", "admin-outbound-message-content", "line-oa-import-content"]).nullable(),
});

const claimRowSchema = z.object({
  outbound_id: z.string().uuid(),
  lead_id: z.string().uuid(),
  attempt_number: z.coerce.number().int().positive(),
  recipient_ciphertext_b64: z.string(),
  recipient_nonce_b64: z.string(),
  recipient_auth_tag_b64: z.string(),
  recipient_key_version: z.coerce.number().int().positive(),
  content_ciphertext_b64: z.string(),
  content_nonce_b64: z.string(),
  content_auth_tag_b64: z.string(),
  content_key_version: z.coerce.number().int().positive(),
});

const systemClaimRowSchema = z.object({
  outbound_id: z.string().uuid(),
  attempt_number: z.coerce.number().int().positive(),
  recipient_ciphertext_b64: z.string(),
  recipient_nonce_b64: z.string(),
  recipient_auth_tag_b64: z.string(),
  recipient_key_version: z.coerce.number().int().positive(),
  content_ciphertext_b64: z.string(),
  content_nonce_b64: z.string(),
  content_auth_tag_b64: z.string(),
  content_key_version: z.coerce.number().int().positive(),
});

export type LineAdvisorInboxSafeItem = {
  leadId: string;
  advisorCaseId: string | null;
  customerCode: string;
  stage: LineCaseStage;
  nextStages: readonly LineCaseStage[];
  journey: string;
  materialReceived: boolean;
  conversationStatus: "open" | "closed";
  unreadCount: number;
  lastActivityAt: string | null;
  priority: "low" | "normal" | "high" | "urgent" | null;
  assignedAdvisor: string | null;
  latestMessageType: string | null;
  latestMessageStatus: string | null;
  latestMessageNeedsHuman: boolean | null;
  updatedAt: string;
  origin: string | null;
  campaignId: string | null;
  contentId: string | null;
  need: string | null;
  toolId: string | null;
  savedResultRef: string | null;
};

export type LineTranscriptItem = {
  itemId: string;
  sourceKind: "message" | "outbound";
  direction: "inbound" | "outbound";
  messageType: string;
  status: string;
  needsHuman: boolean;
  occurredAt: string;
  unsentAt: string | null;
  text: string | null;
  contentState: "available" | "retained_after_unsend" | "purged" | "not_available" | "legacy_key_unavailable" | "decrypt_failed";
};

export type LineStageHistoryItem = {
  id: string;
  from: LineCaseStage;
  to: LineCaseStage;
  createdAt: string;
};

export type LineAdvisorInboxStatus = {
  databaseConfigured: boolean;
  databaseIdentityValid: boolean;
  lane: AdminOperationsLane | null;
  viewReady: boolean;
  privateConversationReady: boolean;
  rawCustomerDataExposedToClient: false;
  transcriptEnabled: boolean;
  replyEnabled: boolean;
  stageMutationEnabled: boolean;
};

export type LineAdvisorInboxReadModel = {
  status: LineAdvisorInboxStatus;
  rows: LineAdvisorInboxSafeItem[];
  aggregate: {
    openCases: number;
    needsHuman: number;
    materialReceived: number;
    stageCounts: Record<LineCaseStage, number>;
  };
  unavailableReason: "admin_runtime_not_ready" | "safe_view_not_ready" | "safe_view_query_failed" | "safe_view_contract_failed" | null;
};

export type LineCaseDetailModel = {
  status: LineAdvisorInboxStatus;
  item: LineAdvisorInboxSafeItem | null;
  stageHistory: LineStageHistoryItem[];
  transcript: {
    state: "available" | "disabled" | "key_unavailable" | "read_failed";
    items: LineTranscriptItem[];
  };
  botDecision: LineBotDecision;
  unavailableReason: string | null;
};

function iso(value: string | Date | null | undefined): string | null {
  return value instanceof Date ? value.toISOString() : value ?? null;
}

export function resolveLineAdvisorInboxRuntime(
  variables: Record<string, string | undefined> = process.env,
) {
  return resolveAdminOperationsRuntimeIdentity(adminOperationsRuntimeInputFromEnvironment(variables));
}

function transcriptCrypto(variables: Record<string, string | undefined>) {
  if (variables.CCPUN_LINE_TRANSCRIPT_ENABLED?.trim() !== "true") return null;
  try { return createLineContentCrypto(variables); } catch { return null; }
}

export function getLineActivationStatus(
  variables: Record<string, string | undefined> = process.env,
) {
  const runtime = resolveLineAdvisorInboxRuntime(variables);
  const cryptoReady = Boolean(transcriptCrypto(variables));
  return {
    runtimeReady: Boolean(runtime && variables.CCPUN_ADMIN_DATABASE_URL?.trim()),
    transcriptEnabled: variables.CCPUN_LINE_TRANSCRIPT_ENABLED?.trim() === "true" && cryptoReady,
    // Advisor replies are intentionally handled in LINE OA Manager. Admin is archive/read-only.
    outboundEnabled: false,
  };
}

async function runtimeSql(variables: Record<string, string | undefined> = process.env) {
  const runtime = resolveLineAdvisorInboxRuntime(variables);
  const connectionString = variables.CCPUN_ADMIN_DATABASE_URL?.trim();
  if (!runtime || !connectionString) return null;
  const sql = neon(connectionString, { fetchOptions: { signal: AbortSignal.timeout(5_000) } });
  return { runtime, sql };
}

type LineAdminSqlClient = NonNullable<Awaited<ReturnType<typeof runtimeSql>>>["sql"];

async function conversationReady(
  sql: LineAdminSqlClient,
) {
  const rows = await sql.query(
    `SELECT
       to_regclass('private_line.advisor_inbox_safe')::text AS safe_view,
       to_regclass('private_line.lead_context_safe')::text AS context_view,
       has_table_privilege(current_user, 'private_line.advisor_inbox_safe', 'SELECT') AS can_read_view,
       has_table_privilege(current_user, 'private_line.lead_context_safe', 'SELECT') AS can_read_context,
       has_function_privilege(current_user, 'private_line.admin_read_advisor_inbox(uuid,integer)', 'EXECUTE') AS can_read_inbox,
       has_function_privilege(current_user, 'private_line.admin_read_line_transcript(uuid,integer)', 'EXECUTE') AS can_read_transcript,
       current_user AS role_name`,
    [],
  ) as Array<{ safe_view: string | null; context_view: string | null; can_read_view: boolean; can_read_context: boolean; can_read_inbox: boolean; can_read_transcript: boolean; role_name: string }>;
  const row = rows[0];
  return Boolean(
    row.safe_view === "private_line.advisor_inbox_safe" &&
    row.context_view === "private_line.lead_context_safe" &&
    row.can_read_view &&
    row.can_read_context &&
    row.can_read_inbox &&
    row.can_read_transcript &&
    row.role_name === "ccpun_admin_runtime"
  );
}

function baseStatus(
  variables: Record<string, string | undefined>,
  viewReady: boolean,
  privateConversationReady: boolean,
): LineAdvisorInboxStatus {
  const runtime = resolveLineAdvisorInboxRuntime(variables);
  const activation = getLineActivationStatus(variables);
  return {
    databaseConfigured: Boolean(variables.CCPUN_ADMIN_DATABASE_URL?.trim()),
    databaseIdentityValid: Boolean(runtime),
    lane: runtime?.lane ?? null,
    viewReady,
    privateConversationReady,
    rawCustomerDataExposedToClient: false,
    transcriptEnabled: activation.transcriptEnabled,
    replyEnabled: false,
    stageMutationEnabled: privateConversationReady,
  };
}

function emptyStageCounts(): Record<LineCaseStage, number> {
  return Object.fromEntries(LINE_CASE_STAGES.map((stage) => [stage, 0])) as Record<LineCaseStage, number>;
}

function normalizeInboxRow(row: z.infer<typeof safeInboxRowSchema>): LineAdvisorInboxSafeItem {
  return {
    leadId: row.lead_id,
    advisorCaseId: row.advisor_case_id,
    customerCode: row.customer_code,
    stage: row.stage,
    nextStages: nextLineCaseStages(row.stage),
    journey: row.journey,
    materialReceived: row.material_received,
    conversationStatus: row.conversation_status,
    unreadCount: row.unread_count,
    lastActivityAt: iso(row.last_activity_at),
    priority: row.priority,
    assignedAdvisor: row.assigned_advisor,
    latestMessageType: row.latest_message_type,
    latestMessageStatus: row.latest_message_status,
    latestMessageNeedsHuman: row.latest_message_needs_human,
    updatedAt: iso(row.updated_at) ?? "",
    origin: row.origin ?? null,
    campaignId: row.campaign_id ?? null,
    contentId: row.content_id ?? null,
    need: row.need ?? null,
    toolId: row.tool_id ?? null,
    savedResultRef: row.saved_result_ref ?? null,
  };
}

function aggregateRows(rows: LineAdvisorInboxSafeItem[]): LineAdvisorInboxReadModel["aggregate"] {
  const aggregate = { openCases: 0, needsHuman: 0, materialReceived: 0, stageCounts: emptyStageCounts() };
  for (const row of rows) {
    if (row.stage !== "Won" && row.stage !== "Lost") aggregate.openCases += 1;
    if (row.latestMessageNeedsHuman) aggregate.needsHuman += 1;
    if (row.materialReceived) aggregate.materialReceived += 1;
    aggregate.stageCounts[row.stage] += 1;
  }
  return aggregate;
}

export async function listAdvisorInboxSafe(
  limit = 50,
  variables: Record<string, string | undefined> = process.env,
): Promise<LineAdvisorInboxReadModel> {
  const handle = await runtimeSql(variables);
  if (!handle) {
    return { status: baseStatus(variables, false, false), rows: [], aggregate: aggregateRows([]), unavailableReason: "admin_runtime_not_ready" };
  }

  try {
    const ready = await conversationReady(handle.sql);
    if (!ready) {
      return { status: baseStatus(variables, false, false), rows: [], aggregate: aggregateRows([]), unavailableReason: "safe_view_not_ready" };
    }
  } catch {
    return { status: baseStatus(variables, false, false), rows: [], aggregate: aggregateRows([]), unavailableReason: "safe_view_query_failed" };
  }

  let rawRows: unknown;
  try {
    rawRows = await handle.sql.query(
      `SELECT lead_id::text, advisor_case_id::text, customer_code, stage, journey,
              material_received, conversation_status, unread_count, last_activity_at,
              priority, assigned_advisor, latest_message_type, latest_message_status,
              latest_message_needs_human, updated_at, origin, campaign_id, content_id, need, tool_id, saved_result_ref
       FROM private_line.admin_read_advisor_inbox(NULL::uuid,$1::integer)`,
      [Math.max(1, Math.min(100, Math.floor(limit)))],
    );
  } catch {
    return { status: baseStatus(variables, true, true), rows: [], aggregate: aggregateRows([]), unavailableReason: "safe_view_query_failed" };
  }

  const parsed = z.array(safeInboxRowSchema).safeParse(rawRows);
  if (!parsed.success) {
    return { status: baseStatus(variables, true, true), rows: [], aggregate: aggregateRows([]), unavailableReason: "safe_view_contract_failed" };
  }

  const normalized = parsed.data.map(normalizeInboxRow);
  return { status: baseStatus(variables, true, true), rows: normalized, aggregate: aggregateRows(normalized), unavailableReason: null };
}

export async function readLineCaseDetail(
  leadId: string,
  variables: Record<string, string | undefined> = process.env,
): Promise<LineCaseDetailModel> {
  if (!z.string().uuid().safeParse(leadId).success) {
    return { status: baseStatus(variables, false, false), item: null, stageHistory: [], transcript: { state: "read_failed", items: [] }, botDecision: "human_handoff", unavailableReason: "invalid_lead_id" };
  }
  const handle = await runtimeSql(variables);
  if (!handle) return { status: baseStatus(variables, false, false), item: null, stageHistory: [], transcript: { state: "read_failed", items: [] }, botDecision: "human_handoff", unavailableReason: "admin_runtime_not_ready" };
  try {
    const ready = await conversationReady(handle.sql);
    if (!ready) return { status: baseStatus(variables, false, false), item: null, stageHistory: [], transcript: { state: "read_failed", items: [] }, botDecision: "human_handoff", unavailableReason: "private_conversation_not_ready" };
    const safeRows = z.array(safeInboxRowSchema).parse(await handle.sql.query(
      `SELECT lead_id::text, advisor_case_id::text, customer_code, stage, journey,
              material_received, conversation_status, unread_count, last_activity_at,
              priority, assigned_advisor, latest_message_type, latest_message_status,
              latest_message_needs_human, updated_at, origin, campaign_id, content_id, need, tool_id, saved_result_ref
       FROM private_line.admin_read_advisor_inbox($1::uuid,1::integer)`, [leadId],
    ));
    const item = safeRows[0] ? normalizeInboxRow(safeRows[0]) : null;
    if (!item) return { status: baseStatus(variables, true, true), item: null, stageHistory: [], transcript: { state: "read_failed", items: [] }, botDecision: "human_handoff", unavailableReason: "lead_not_found" };
    const historyRows = z.array(stageHistorySchema).parse(await handle.sql.query(
      `SELECT lead_stage_history_id::text, lead_id::text, from_stage, to_stage, created_at
       FROM private_line.lead_stage_history_safe WHERE lead_id=$1::uuid ORDER BY created_at ASC`, [leadId],
    ));
    const stageHistory = historyRows.map((row) => ({ id: row.lead_stage_history_id, from: row.from_stage, to: row.to_stage, createdAt: iso(row.created_at) ?? "" }));
    const botDecision = routeLineBot({
      approvedAnswerAvailable: false,
      approvedContentAvailable: Boolean(item.contentId),
      approvedToolAvailable: Boolean(item.toolId),
      qualificationNeeded: item.stage === "New",
      personalized: true,
      suitabilityRequired: false,
      recommendationRequired: false,
      quoteRequired: item.journey === "motor_quote_review" && item.stage === "Quote",
      explicitHumanRequest: item.latestMessageNeedsHuman === true,
    });

    if (variables.CCPUN_LINE_TRANSCRIPT_ENABLED?.trim() !== "true") {
      return { status: baseStatus(variables, true, true), item, stageHistory, transcript: { state: "disabled", items: [] }, botDecision, unavailableReason: null };
    }
    const crypto = transcriptCrypto(variables);
    if (!crypto) return { status: baseStatus(variables, true, true), item, stageHistory, transcript: { state: "key_unavailable", items: [] }, botDecision, unavailableReason: null };
    try {
      const dbRows = z.array(transcriptRowSchema).parse(await handle.sql.query(
        `SELECT item_id::text, source_kind, direction, message_type, status, needs_human, occurred_at, unsent_at,
                content_ciphertext_b64, content_nonce_b64, content_auth_tag_b64, content_key_version, content_purpose
         FROM private_line.admin_read_line_transcript($1::uuid,$2::integer)`, [leadId, 200],
      ));
      const messages: LineTranscriptItem[] = dbRows.map((row) => {
        const base = {
          itemId: row.item_id,
          sourceKind: row.source_kind,
          direction: row.direction,
          messageType: row.message_type,
          status: row.status,
          needsHuman: row.needs_human,
          occurredAt: iso(row.occurred_at) ?? "",
          unsentAt: iso(row.unsent_at),
        };
        if (!row.content_ciphertext_b64 || !row.content_nonce_b64 || !row.content_auth_tag_b64 || !row.content_key_version || !row.content_purpose) {
          return { ...base, text: null, contentState: row.status === "unsent" ? "purged" as const : "not_available" as const };
        }
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
          const text = crypto.decrypt(encrypted, row.content_purpose);
          return { ...base, text, contentState: row.status === "unsent" ? "retained_after_unsend" as const : "available" as const };
        } catch (error) {
          if (isLinePrivateKeyUnavailableError(error)) {
            return { ...base, text: null, contentState: "legacy_key_unavailable" as const };
          }
          return { ...base, text: null, contentState: "decrypt_failed" as const };
        }
      });
      return { status: baseStatus(variables, true, true), item, stageHistory, transcript: { state: "available", items: messages }, botDecision, unavailableReason: null };
    } catch {
      return { status: baseStatus(variables, true, true), item, stageHistory, transcript: { state: "read_failed", items: [] }, botDecision, unavailableReason: null };
    }
  } catch {
    return { status: baseStatus(variables, false, false), item: null, stageHistory: [], transcript: { state: "read_failed", items: [] }, botDecision: "human_handoff", unavailableReason: "case_read_failed" };
  }
}

function digest(...parts: string[]) {
  const hash = createHash("sha256");
  for (const part of parts) hash.update(part).update("\0");
  return hash.digest("hex");
}

export async function enqueueLineAdminReply(input: {
  leadId: string;
  text: string;
  actor: string;
  requestId?: string;
}, variables: Record<string, string | undefined> = process.env) {
  const text = input.text.trim();
  if (!z.string().uuid().safeParse(input.leadId).success || !text || text.length > 2000) throw new Error("LINE_REPLY_INVALID");
  const handle = await runtimeSql(variables);
  const crypto = createLineContentCrypto(variables);
  if (!handle || !(await conversationReady(handle.sql))) throw new Error("LINE_ADMIN_RUNTIME_NOT_READY");
  const requestId = input.requestId ?? randomUUID();
  const encrypted = crypto.encrypt(text, "admin-outbound-message-content");
  const payload = {
    lead_id: input.leadId,
    idempotency_digest: digest("ccpun-line-admin-reply-v1", input.leadId, input.actor, requestId, text),
    content_ciphertext_b64: encrypted.ciphertextB64,
    content_nonce_b64: encrypted.nonceB64,
    content_auth_tag_b64: encrypted.authTagB64,
    content_key_version: encrypted.keyVersion,
    created_by_digest: digest("ccpun-admin-actor-v1", input.actor),
  };
  const rows = await handle.sql.query(`SELECT outcome, outbound_id::text FROM private_line.admin_enqueue_line_reply($1::jsonb)`, [JSON.stringify(payload)]) as Array<{ outcome?: unknown; outbound_id?: unknown }>;
  if ((rows[0]?.outcome !== "queued" && rows[0]?.outcome !== "duplicate") || typeof rows[0]?.outbound_id !== "string") throw new Error("LINE_REPLY_ENQUEUE_FAILED");
  return { outcome: rows[0].outcome as "queued" | "duplicate", outboundId: rows[0].outbound_id };
}

export async function claimLineOutbound(
  outboundId: string,
  workerDigest: string,
  variables: Record<string, string | undefined> = process.env,
) {
  const handle = await runtimeSql(variables);
  if (!handle || !(await conversationReady(handle.sql))) throw new Error("LINE_ADMIN_RUNTIME_NOT_READY");
  const rows = z.array(claimRowSchema).parse(await handle.sql.query(
    `SELECT outbound_id::text, lead_id::text, attempt_number, recipient_ciphertext_b64, recipient_nonce_b64,
            recipient_auth_tag_b64, recipient_key_version, content_ciphertext_b64, content_nonce_b64,
            content_auth_tag_b64, content_key_version
     FROM private_line.admin_claim_line_outbound($1::jsonb)`, [JSON.stringify({ worker_digest: workerDigest, outbound_id: outboundId })],
  ));
  return rows[0] ?? null;
}

export async function claimLineSystemOutbound(
  outboundId: string,
  workerDigest: string,
  dispatchTokenDigest: string,
  variables: Record<string, string | undefined> = process.env,
) {
  if (
    !z.string().uuid().safeParse(outboundId).success
    || !/^[0-9a-f]{64}$/.test(workerDigest)
    || !/^[0-9a-f]{64}$/.test(dispatchTokenDigest)
  ) throw new Error("LINE_SYSTEM_OUTBOUND_CLAIM_INVALID");

  const handle = await runtimeSql(variables);
  if (!handle) throw new Error("LINE_ADMIN_RUNTIME_NOT_READY");
  const rows = z.array(systemClaimRowSchema).parse(await handle.sql.query(
    `SELECT outbound_id::text,attempt_number,
            recipient_ciphertext_b64,recipient_nonce_b64,recipient_auth_tag_b64,recipient_key_version,
            content_ciphertext_b64,content_nonce_b64,content_auth_tag_b64,content_key_version
       FROM private_line.admin_claim_line_system_outbound($1::jsonb)`,
    [JSON.stringify({
      worker_digest: workerDigest,
      outbound_id: outboundId,
      dispatch_token_digest: dispatchTokenDigest,
    })],
  ));
  return rows[0] ?? null;
}

export async function checkpointLineOutbound(input: {
  outboundId: string;
  workerDigest: string;
  result: "sent" | "failed" | "reconciliation_required";
  providerStatusCode?: number;
  errorClass?: string;
}, variables: Record<string, string | undefined> = process.env) {
  const handle = await runtimeSql(variables);
  if (!handle || !(await conversationReady(handle.sql))) throw new Error("LINE_ADMIN_RUNTIME_NOT_READY");
  const rows = await handle.sql.query(`SELECT outcome FROM private_line.admin_checkpoint_line_outbound($1::jsonb)`, [JSON.stringify({
    outbound_id: input.outboundId,
    worker_digest: input.workerDigest,
    result: input.result,
    provider_status_code: input.providerStatusCode ?? null,
    error_class: input.errorClass ?? null,
  })]) as Array<{ outcome?: unknown }>;
  if (rows[0]?.outcome !== input.result) throw new Error("LINE_OUTBOUND_CHECKPOINT_FAILED");
  return input.result;
}

export async function updateLineLeadStage(input: {
  leadId: string;
  stage: LineCaseStage;
  actor: string;
}, variables: Record<string, string | undefined> = process.env) {
  if (!z.string().uuid().safeParse(input.leadId).success || !isLineCaseStage(input.stage)) throw new Error("LINE_STAGE_INVALID");
  const detail = await readLineCaseDetail(input.leadId, variables);
  if (!detail.item || !canTransitionLineCaseStage(detail.item.stage, input.stage)) throw new Error("LINE_STAGE_TRANSITION_INVALID");
  const handle = await runtimeSql(variables);
  if (!handle || !(await conversationReady(handle.sql))) throw new Error("LINE_ADMIN_RUNTIME_NOT_READY");
  const rows = await handle.sql.query(`SELECT outcome, lead_id::text FROM private_line.admin_update_lead_stage($1::jsonb)`, [JSON.stringify({
    lead_id: input.leadId,
    stage: input.stage,
    actor_digest: digest("ccpun-admin-actor-v1", input.actor),
  })]) as Array<{ outcome?: unknown; lead_id?: unknown }>;
  if (rows[0]?.outcome !== "updated" || rows[0]?.lead_id !== input.leadId) throw new Error("LINE_STAGE_UPDATE_FAILED");
  return { outcome: "updated" as const, leadId: input.leadId };
}

export function lineWorkerDigest(outboundId: string, variables: Record<string, string | undefined> = process.env) {
  return digest("ccpun-line-outbound-worker-v1", outboundId, variables.VERCEL_DEPLOYMENT_ID?.trim() ?? "local");
}
