import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { z } from "zod";
import {
  adminOperationsRuntimeInputFromEnvironment,
  resolveAdminOperationsRuntimeIdentity,
} from "../operations/foundation";

const implementationStatusSchema = z.enum(["planned", "in_progress", "complete", "cancelled"]);
const currencySchema = z.string().regex(/^[A-Z]{3}$/);
const privacyTypeSchema = z.enum(["export", "delete"]);
const privacyStatusSchema = z.enum(["requested", "verified", "prepared", "approved", "executed", "cancelled", "failed"]);
const safeIdSchema = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,79}$/);

const conversionSummarySchema = z.object({
  line_continue_count: z.coerce.number().int().nonnegative(),
  lead_count: z.coerce.number().int().nonnegative(),
  material_received_count: z.coerce.number().int().nonnegative(),
  qualified_count: z.coerce.number().int().nonnegative(),
  solution_quote_count: z.coerce.number().int().nonnegative(),
  implementation_started_count: z.coerce.number().int().nonnegative(),
  implementation_complete_count: z.coerce.number().int().nonnegative(),
  won_count: z.coerce.number().int().nonnegative(),
  lost_count: z.coerce.number().int().nonnegative(),
  revenue_record_count: z.coerce.number().int().nonnegative(),
});

const revenueSummarySchema = z.object({
  currency: currencySchema,
  revenue_minor: z.coerce.number().nonnegative(),
  revenue_record_count: z.coerce.number().int().nonnegative(),
});

const contentIntelligenceSchema = z.object({
  origin: z.string().min(1).max(80),
  journey: z.string().min(1).max(80),
  content_id: z.string().max(80).nullable(),
  campaign_id: z.string().max(80).nullable(),
  tool_id: z.string().max(80).nullable(),
  journey_start_count: z.coerce.number().int().nonnegative(),
  lead_count: z.coerce.number().int().nonnegative(),
  material_received_count: z.coerce.number().int().nonnegative(),
  qualified_count: z.coerce.number().int().nonnegative(),
  qualification_rate: z.coerce.number().min(0).max(1).nullable(),
  implementation_complete_count: z.coerce.number().int().nonnegative(),
  won_count: z.coerce.number().int().nonnegative(),
  lost_count: z.coerce.number().int().nonnegative(),
  revenue_record_count: z.coerce.number().int().nonnegative(),
  drop_off_count: z.coerce.number().int().nonnegative(),
});

const contentRevenueSchema = z.object({
  origin: z.string().min(1).max(80),
  journey: z.string().min(1).max(80),
  content_id: z.string().max(80).nullable(),
  campaign_id: z.string().max(80).nullable(),
  tool_id: z.string().max(80).nullable(),
  currency: currencySchema,
  revenue_minor: z.coerce.number().nonnegative().nullable(),
  revenue_record_count: z.coerce.number().int().nonnegative(),
  revenue_suppressed: z.boolean(),
});

const safeQuestionFrequencySchema = z.object({
  question_id: z.string().min(1).max(80),
  journey: z.string().min(1).max(80),
  outcome: z.enum(["approved_answer", "related_content", "human_handoff"]),
  reason: z.enum(["human_requested", "personalized", "no_approved_answer", "source_unavailable"]).nullable(),
  request_count: z.coerce.number().int().nonnegative(),
  last_seen_at: z.union([z.string(), z.date()]),
});

const contentGapInputSchema = z.object({
  question_id: z.string().min(1).max(80),
  journey: z.string().min(1).max(80),
  no_approved_answer_count: z.coerce.number().int().nonnegative(),
  source_unavailable_count: z.coerce.number().int().nonnegative(),
  total_gap_signal_count: z.coerce.number().int().nonnegative(),
  last_seen_at: z.union([z.string(), z.date()]).nullable(),
});

const privacyRequestSchema = z.object({
  privacy_request_id: z.string().uuid(),
  request_type: privacyTypeSchema,
  status: privacyStatusSchema,
  requested_at: z.union([z.string(), z.date()]),
  verified_at: z.union([z.string(), z.date()]).nullable(),
  prepared_at: z.union([z.string(), z.date()]).nullable(),
  approved_at: z.union([z.string(), z.date()]).nullable(),
  executed_at: z.union([z.string(), z.date()]).nullable(),
  cancelled_at: z.union([z.string(), z.date()]).nullable(),
  failed_at: z.union([z.string(), z.date()]).nullable(),
});

const privacyPlanSchema = z.object({
  request_type: privacyTypeSchema,
  status: privacyStatusSchema,
  conversation_count: z.coerce.number().int().nonnegative(),
  message_count: z.coerce.number().int().nonnegative(),
  document_count: z.coerce.number().int().nonnegative(),
  lead_count: z.coerce.number().int().nonnegative(),
  advisor_case_count: z.coerce.number().int().nonnegative(),
  business_event_count: z.coerce.number().int().nonnegative(),
  implementation_count: z.coerce.number().int().nonnegative(),
  revenue_record_count: z.coerce.number().int().nonnegative(),
  destructive_execution_available: z.boolean(),
});

const privacyExportPreparationSchema = z.object({
  outcome: z.literal("prepared"),
  conversation_count: z.coerce.number().int().nonnegative(),
  message_count: z.coerce.number().int().nonnegative(),
  document_count: z.coerce.number().int().nonnegative(),
  lead_count: z.coerce.number().int().nonnegative(),
  advisor_case_count: z.coerce.number().int().nonnegative(),
  business_event_count: z.coerce.number().int().nonnegative(),
  implementation_count: z.coerce.number().int().nonnegative(),
  revenue_record_count: z.coerce.number().int().nonnegative(),
  raw_payload_materialized: z.literal(false),
});

const privacyDeletePreparationSchema = z.object({
  outcome: z.literal("prepared"),
  conversation_count: z.coerce.number().int().nonnegative(),
  message_count: z.coerce.number().int().nonnegative(),
  document_count: z.coerce.number().int().nonnegative(),
  lead_count: z.coerce.number().int().nonnegative(),
  advisor_case_count: z.coerce.number().int().nonnegative(),
  business_event_count: z.coerce.number().int().nonnegative(),
  implementation_count: z.coerce.number().int().nonnegative(),
  revenue_record_count: z.coerce.number().int().nonnegative(),
  attachment_cleanup_required_count: z.coerce.number().int().nonnegative(),
  destructive_execution_available: z.literal(false),
});

const privacySafetyHealthSchema = z.object({
  retention_mode: z.literal("manual_review"),
  automatic_delete_enabled: z.literal(false),
  conversation_review_after_days: z.coerce.number().int().positive().nullable(),
  document_review_after_days: z.coerce.number().int().positive().nullable(),
  audit_review_after_days: z.coerce.number().int().positive().nullable(),
  attachment_unsend_action: z.literal("revoke_then_delete"),
  prepared_export_manifest_count: z.coerce.number().int().nonnegative(),
  prepared_delete_tombstone_count: z.coerce.number().int().nonnegative(),
  attachment_cleanup_required_count: z.coerce.number().int().nonnegative(),
  destructive_execution_available: z.literal(false),
  backup_restore_evidence_state: z.literal("external_verification_required"),
  key_rotation_evidence_state: z.literal("aggregate_status_available"),
});

const deliveryHealthSchema = z.object({
  outbound_queued: z.coerce.number().int().nonnegative(),
  outbound_leased: z.coerce.number().int().nonnegative(),
  outbound_sent: z.coerce.number().int().nonnegative(),
  outbound_retryable_failed: z.coerce.number().int().nonnegative(),
  outbound_dead_letter: z.coerce.number().int().nonnegative(),
  outbound_reconciliation: z.coerce.number().int().nonnegative(),
  campaign_queued: z.coerce.number().int().nonnegative(),
  campaign_leased: z.coerce.number().int().nonnegative(),
  campaign_sent: z.coerce.number().int().nonnegative(),
  campaign_retryable_failed: z.coerce.number().int().nonnegative(),
  campaign_dead_letter: z.coerce.number().int().nonnegative(),
  campaign_reconciliation: z.coerce.number().int().nonnegative(),
});

const opsHealthSchema = z.object({
  outbound_queued: z.coerce.number().int().nonnegative(),
  outbound_failed: z.coerce.number().int().nonnegative(),
  outbound_reconciliation: z.coerce.number().int().nonnegative(),
  campaign_queued: z.coerce.number().int().nonnegative(),
  campaign_reconciliation: z.coerce.number().int().nonnegative(),
  privacy_pending: z.coerce.number().int().nonnegative(),
  business_event_count: z.coerce.number().int().nonnegative(),
  latest_business_event_at: z.union([z.string(), z.date()]).nullable(),
  retention_mode: z.literal("manual_review"),
  automatic_delete_enabled: z.literal(false),
});

function iso(value: string | Date | null) {
  return value instanceof Date ? value.toISOString() : value;
}

function digest(...parts: string[]) {
  const hash = createHash("sha256");
  for (const part of parts) hash.update(part).update("\0");
  return hash.digest("hex");
}

async function adminSql(variables: Record<string, string | undefined> = process.env) {
  const runtime = resolveAdminOperationsRuntimeIdentity(adminOperationsRuntimeInputFromEnvironment(variables));
  const connectionString = variables.CCPUN_ADMIN_DATABASE_URL?.trim();
  if (!runtime || !connectionString) return null;
  return neon(connectionString, { fetchOptions: { signal: AbortSignal.timeout(5_000) } });
}

export async function recordLeadImplementation(input: {
  leadId: string;
  status: z.infer<typeof implementationStatusSchema>;
  partnerCode?: string | null;
  actor: string;
  requestId?: string;
}, variables: Record<string, string | undefined> = process.env) {
  if (!z.string().uuid().safeParse(input.leadId).success) throw new Error("LINE_IMPLEMENTATION_INVALID");
  const status = implementationStatusSchema.safeParse(input.status);
  const partner = input.partnerCode == null || input.partnerCode === "" ? null : safeIdSchema.safeParse(input.partnerCode);
  if (!status.success || (partner && !partner.success)) throw new Error("LINE_IMPLEMENTATION_INVALID");

  const sql = await adminSql(variables);
  if (!sql) throw new Error("LINE_ADMIN_RUNTIME_NOT_READY");
  const requestId = input.requestId ?? randomUUID();
  const eventKey = `impl:${digest(input.leadId, input.status, input.actor, requestId)}`;
  const rows = await sql.query(
    "SELECT outcome FROM private_line.admin_record_implementation($1::jsonb)",
    [JSON.stringify({
      lead_id: input.leadId,
      status: input.status,
      partner_code: partner ? partner.data : null,
      actor_digest: digest("ccpun-admin-actor-v1", input.actor),
      event_key: eventKey,
    })],
  ) as Array<{ outcome?: unknown }>;
  if (rows[0]?.outcome !== "recorded") throw new Error("LINE_IMPLEMENTATION_WRITE_FAILED");
  return { outcome: "recorded" as const };
}

export async function attributeLeadRevenue(input: {
  leadId: string;
  amountMinor: number;
  currency: string;
  actor: string;
  requestId?: string;
}, variables: Record<string, string | undefined> = process.env) {
  if (!z.string().uuid().safeParse(input.leadId).success || !Number.isSafeInteger(input.amountMinor) || input.amountMinor < 0) {
    throw new Error("LINE_REVENUE_INVALID");
  }
  const currency = currencySchema.safeParse(input.currency);
  if (!currency.success) throw new Error("LINE_REVENUE_INVALID");

  const sql = await adminSql(variables);
  if (!sql) throw new Error("LINE_ADMIN_RUNTIME_NOT_READY");
  const requestId = input.requestId ?? randomUUID();
  const idempotencyDigest = digest("ccpun-line-revenue-v1", input.leadId, String(input.amountMinor), currency.data, input.actor, requestId);
  const rows = await sql.query(
    "SELECT outcome,revenue_id::text FROM private_line.admin_attribute_revenue($1::jsonb)",
    [JSON.stringify({
      lead_id: input.leadId,
      amount_minor: input.amountMinor,
      currency: currency.data,
      idempotency_digest: idempotencyDigest,
      actor_digest: digest("ccpun-admin-actor-v1", input.actor),
    })],
  ) as Array<{ outcome?: unknown; revenue_id?: unknown }>;
  if ((rows[0]?.outcome !== "recorded" && rows[0]?.outcome !== "duplicate") || typeof rows[0]?.revenue_id !== "string") {
    throw new Error("LINE_REVENUE_WRITE_FAILED");
  }
  return { outcome: rows[0].outcome as "recorded" | "duplicate", revenueId: rows[0].revenue_id };
}

export async function bindLeadAttribution(input: {
  leadId: string;
  journeyEventId: string;
  actor: string;
}, variables: Record<string, string | undefined> = process.env) {
  if (!z.string().uuid().safeParse(input.leadId).success || !z.string().uuid().safeParse(input.journeyEventId).success) {
    throw new Error("LINE_ATTRIBUTION_INVALID");
  }
  const sql = await adminSql(variables);
  if (!sql) throw new Error("LINE_ADMIN_RUNTIME_NOT_READY");
  const rows = await sql.query(
    "SELECT outcome FROM private_line.admin_bind_lead_attribution($1::jsonb)",
    [JSON.stringify({
      lead_id: input.leadId,
      journey_event_id: input.journeyEventId,
      actor_digest: digest("ccpun-admin-actor-v1", input.actor),
    })],
  ) as Array<{ outcome?: unknown }>;
  if (rows[0]?.outcome !== "linked" && rows[0]?.outcome !== "duplicate") throw new Error("LINE_ATTRIBUTION_WRITE_FAILED");
  return { outcome: rows[0].outcome as "linked" | "duplicate" };
}

export async function readConversionAnalytics(
  variables: Record<string, string | undefined> = process.env,
) {
  const sql = await adminSql(variables);
  if (!sql) {
    return {
      state: "not_ready" as const,
      summary: null,
      revenue: [],
      content: [],
      contentRevenue: [],
      questionFrequency: [],
      contentGapInputs: [],
    };
  }
  try {
    const [summaryRows, revenueRows, contentRows, contentRevenueRows, questionRows, gapRows] = await Promise.all([
      sql.query("SELECT * FROM private_line.admin_read_conversion_summary()", []),
      sql.query("SELECT currency,revenue_minor,revenue_record_count FROM private_line.admin_read_revenue_by_currency()", []),
      sql.query(
        "SELECT origin,journey,content_id,campaign_id,tool_id,journey_start_count,lead_count,material_received_count,qualified_count,qualification_rate,implementation_complete_count,won_count,lost_count,revenue_record_count,drop_off_count FROM private_line.admin_read_content_intelligence_v2($1::integer)",
        [100],
      ),
      sql.query(
        "SELECT origin,journey,content_id,campaign_id,tool_id,currency,revenue_minor,revenue_record_count,revenue_suppressed FROM private_line.admin_read_content_revenue_by_currency($1::integer)",
        [200],
      ),
      sql.query(
        "SELECT question_id,journey,outcome,reason,request_count,last_seen_at FROM private_line.admin_read_safe_question_frequency($1::integer)",
        [100],
      ),
      sql.query(
        "SELECT question_id,journey,no_approved_answer_count,source_unavailable_count,total_gap_signal_count,last_seen_at FROM private_line.admin_read_content_gap_inputs($1::integer)",
        [100],
      ),
    ]);
    const summary = conversionSummarySchema.array().parse(summaryRows)[0] ?? null;
    return {
      state: "ready" as const,
      summary,
      revenue: revenueSummarySchema.array().parse(revenueRows).map((row) => ({
        currency: row.currency,
        revenueMinor: row.revenue_minor,
        revenueRecordCount: row.revenue_record_count,
      })),
      content: contentIntelligenceSchema.array().parse(contentRows).map((row) => ({
        origin: row.origin,
        journey: row.journey,
        contentId: row.content_id,
        campaignId: row.campaign_id,
        toolId: row.tool_id,
        journeyStartCount: row.journey_start_count,
        leadCount: row.lead_count,
        materialReceivedCount: row.material_received_count,
        qualifiedCount: row.qualified_count,
        qualificationRate: row.qualification_rate,
        implementationCompleteCount: row.implementation_complete_count,
        wonCount: row.won_count,
        lostCount: row.lost_count,
        revenueRecordCount: row.revenue_record_count,
        dropOffCount: row.drop_off_count,
      })),
      contentRevenue: contentRevenueSchema.array().parse(contentRevenueRows).map((row) => ({
        origin: row.origin,
        journey: row.journey,
        contentId: row.content_id,
        campaignId: row.campaign_id,
        toolId: row.tool_id,
        currency: row.currency,
        revenueMinor: row.revenue_minor,
        revenueRecordCount: row.revenue_record_count,
        revenueSuppressed: row.revenue_suppressed,
      })),
      questionFrequency: safeQuestionFrequencySchema.array().parse(questionRows).map((row) => ({
        questionId: row.question_id,
        journey: row.journey,
        outcome: row.outcome,
        reason: row.reason,
        requestCount: row.request_count,
        lastSeenAt: iso(row.last_seen_at) ?? "",
      })),
      contentGapInputs: contentGapInputSchema.array().parse(gapRows).map((row) => ({
        questionId: row.question_id,
        journey: row.journey,
        noApprovedAnswerCount: row.no_approved_answer_count,
        sourceUnavailableCount: row.source_unavailable_count,
        totalGapSignalCount: row.total_gap_signal_count,
        lastSeenAt: iso(row.last_seen_at),
      })),
    };
  } catch {
    return {
      state: "unavailable" as const,
      summary: null,
      revenue: [],
      content: [],
      contentRevenue: [],
      questionFrequency: [],
      contentGapInputs: [],
    };
  }
}

export async function listPrivacyRequests(
  variables: Record<string, string | undefined> = process.env,
) {
  const sql = await adminSql(variables);
  if (!sql) return { state: "not_ready" as const, requests: [] };
  try {
    const rows = privacyRequestSchema.array().parse(await sql.query(
      "SELECT privacy_request_id::text,request_type,status,requested_at,verified_at,prepared_at,approved_at,executed_at,cancelled_at,failed_at FROM private_line.admin_read_privacy_requests($1::integer)",
      [100],
    ));
    return {
      state: "ready" as const,
      requests: rows.map((row) => ({
        id: row.privacy_request_id,
        requestType: row.request_type,
        status: row.status,
        requestedAt: iso(row.requested_at) ?? "",
        verifiedAt: iso(row.verified_at),
        preparedAt: iso(row.prepared_at),
        approvedAt: iso(row.approved_at),
        executedAt: iso(row.executed_at),
        cancelledAt: iso(row.cancelled_at),
        failedAt: iso(row.failed_at),
      })),
    };
  } catch {
    return { state: "unavailable" as const, requests: [] };
  }
}

export async function createPrivacyRequest(input: {
  requestType: z.infer<typeof privacyTypeSchema>;
  leadId?: string | null;
  customerId?: string | null;
  actor: string;
}, variables: Record<string, string | undefined> = process.env) {
  const requestType = privacyTypeSchema.safeParse(input.requestType);
  const leadOk = input.leadId == null || z.string().uuid().safeParse(input.leadId).success;
  const customerOk = input.customerId == null || z.string().uuid().safeParse(input.customerId).success;
  if (!requestType.success || !leadOk || !customerOk || (!input.leadId && !input.customerId)) throw new Error("PRIVACY_REQUEST_INVALID");
  const sql = await adminSql(variables);
  if (!sql) throw new Error("LINE_ADMIN_RUNTIME_NOT_READY");
  const rows = await sql.query(
    "SELECT outcome,privacy_request_id::text FROM private_line.admin_create_privacy_request($1::jsonb)",
    [JSON.stringify({
      request_type: requestType.data,
      lead_id: input.leadId ?? null,
      customer_id: input.customerId ?? null,
      actor_digest: digest("ccpun-admin-actor-v1", input.actor),
    })],
  ) as Array<{ outcome?: unknown; privacy_request_id?: unknown }>;
  if (rows[0]?.outcome !== "requested" || typeof rows[0]?.privacy_request_id !== "string") throw new Error("PRIVACY_REQUEST_CREATE_FAILED");
  return { outcome: "requested" as const, requestId: rows[0].privacy_request_id };
}

export async function transitionPrivacyRequest(input: {
  requestId: string;
  status: Exclude<z.infer<typeof privacyStatusSchema>, "requested">;
  actor: string;
  verificationToken?: string | null;
}, variables: Record<string, string | undefined> = process.env) {
  if (!z.string().uuid().safeParse(input.requestId).success || !privacyStatusSchema.exclude(["requested"]).safeParse(input.status).success) {
    throw new Error("PRIVACY_TRANSITION_INVALID");
  }
  if (input.status === "executed") throw new Error("PRIVACY_DELETE_EXECUTION_HUMAN_GATE");
  const sql = await adminSql(variables);
  if (!sql) throw new Error("LINE_ADMIN_RUNTIME_NOT_READY");
  const verificationDigest = input.verificationToken ? digest("ccpun-privacy-verify-v1", input.verificationToken) : null;
  const rows = await sql.query(
    "SELECT outcome FROM private_line.admin_transition_privacy_request($1::jsonb)",
    [JSON.stringify({
      privacy_request_id: input.requestId,
      status: input.status,
      actor_digest: digest("ccpun-admin-actor-v1", input.actor),
      verification_digest: verificationDigest,
    })],
  ) as Array<{ outcome?: unknown }>;
  if (rows[0]?.outcome !== input.status) throw new Error("PRIVACY_TRANSITION_FAILED");
  return { outcome: input.status };
}

export async function preparePrivacyRequest(
  requestId: string,
  variables: Record<string, string | undefined> = process.env,
) {
  if (!z.string().uuid().safeParse(requestId).success) throw new Error("PRIVACY_REQUEST_INVALID");
  const sql = await adminSql(variables);
  if (!sql) throw new Error("LINE_ADMIN_RUNTIME_NOT_READY");
  const rows = privacyPlanSchema.array().parse(await sql.query(
    "SELECT request_type,status,conversation_count,message_count,document_count,lead_count,advisor_case_count,business_event_count,implementation_count,revenue_record_count,destructive_execution_available FROM private_line.admin_prepare_privacy_request($1::uuid)",
    [requestId],
  ));
  const row = rows[0];
  if (!row) throw new Error("PRIVACY_PREPARE_FAILED");
  const common = {
    requestType: row.request_type,
    status: row.status,
    counts: {
      conversations: row.conversation_count,
      messages: row.message_count,
      documents: row.document_count,
      leads: row.lead_count,
      advisorCases: row.advisor_case_count,
      businessEvents: row.business_event_count,
      implementations: row.implementation_count,
      revenueRecords: row.revenue_record_count,
    },
    destructiveExecutionAvailable: row.destructive_execution_available,
  };

  if (row.request_type === "export") {
    const prepared = privacyExportPreparationSchema.array().parse(await sql.query(
      "SELECT outcome,conversation_count,message_count,document_count,lead_count,advisor_case_count,business_event_count,implementation_count,revenue_record_count,raw_payload_materialized FROM private_line.admin_prepare_privacy_export($1::uuid)",
      [requestId],
    ))[0];
    if (!prepared) throw new Error("PRIVACY_EXPORT_PREPARE_FAILED");
    return {
      ...common,
      preparationKind: "export_manifest" as const,
      rawPayloadMaterialized: prepared.raw_payload_materialized,
      attachmentCleanupRequired: 0,
    };
  }

  const prepared = privacyDeletePreparationSchema.array().parse(await sql.query(
    "SELECT outcome,conversation_count,message_count,document_count,lead_count,advisor_case_count,business_event_count,implementation_count,revenue_record_count,attachment_cleanup_required_count,destructive_execution_available FROM private_line.admin_prepare_privacy_delete($1::uuid)",
    [requestId],
  ))[0];
  if (!prepared) throw new Error("PRIVACY_DELETE_PREPARE_FAILED");
  return {
    ...common,
    preparationKind: "delete_tombstone" as const,
    rawPayloadMaterialized: false,
    attachmentCleanupRequired: prepared.attachment_cleanup_required_count,
    destructiveExecutionAvailable: prepared.destructive_execution_available,
  };
}

export async function readPrivacySafetyHealth(
  variables: Record<string, string | undefined> = process.env,
) {
  const sql = await adminSql(variables);
  if (!sql) return { state: "not_ready" as const };
  try {
    const row = privacySafetyHealthSchema.array().parse(await sql.query(
      "SELECT * FROM private_line.admin_read_privacy_safety_health()",
      [],
    ))[0];
    if (!row) return { state: "unavailable" as const };
    return {
      state: "ready" as const,
      retentionMode: row.retention_mode,
      automaticDeleteEnabled: row.automatic_delete_enabled,
      conversationReviewAfterDays: row.conversation_review_after_days,
      documentReviewAfterDays: row.document_review_after_days,
      auditReviewAfterDays: row.audit_review_after_days,
      attachmentUnsendAction: row.attachment_unsend_action,
      preparedExportManifestCount: row.prepared_export_manifest_count,
      preparedDeleteTombstoneCount: row.prepared_delete_tombstone_count,
      attachmentCleanupRequiredCount: row.attachment_cleanup_required_count,
      destructiveExecutionAvailable: row.destructive_execution_available,
      backupRestoreEvidenceState: row.backup_restore_evidence_state,
      keyRotationEvidenceState: row.key_rotation_evidence_state,
    };
  } catch {
    return { state: "unavailable" as const };
  }
}

export async function updateRetentionPolicy(input: {
  conversationReviewAfterDays?: number | null;
  documentReviewAfterDays?: number | null;
  auditReviewAfterDays?: number | null;
  actor: string;
}, variables: Record<string, string | undefined> = process.env) {
  const values = [
    input.conversationReviewAfterDays,
    input.documentReviewAfterDays,
    input.auditReviewAfterDays,
  ];
  if (values.some((value) => value != null && (!Number.isInteger(value) || value < 1 || value > 36500))) {
    throw new Error("RETENTION_POLICY_INVALID");
  }
  const sql = await adminSql(variables);
  if (!sql) throw new Error("LINE_ADMIN_RUNTIME_NOT_READY");
  const rows = await sql.query(
    "SELECT outcome FROM private_line.admin_update_retention_policy($1::jsonb)",
    [JSON.stringify({
      policy_mode: "manual_review",
      automatic_delete_enabled: false,
      conversation_review_after_days: input.conversationReviewAfterDays ?? null,
      document_review_after_days: input.documentReviewAfterDays ?? null,
      audit_review_after_days: input.auditReviewAfterDays ?? null,
      attachment_unsend_action: "revoke_then_delete",
      actor_digest: digest("ccpun-admin-actor-v1", input.actor),
    })],
  ) as Array<{ outcome?: unknown }>;
  if (rows[0]?.outcome !== "updated") throw new Error("RETENTION_POLICY_UPDATE_FAILED");
  return { outcome: "updated" as const };
}

export async function readLineDeliveryHealth(
  variables: Record<string, string | undefined> = process.env,
) {
  const sql = await adminSql(variables);
  if (!sql) return { state: "not_ready" as const };
  try {
    const row = deliveryHealthSchema.array().parse(await sql.query(
      "SELECT * FROM private_line.admin_read_line_delivery_health()",
      [],
    ))[0];
    if (!row) return { state: "unavailable" as const };
    return {
      state: "ready" as const,
      outboundQueued: row.outbound_queued,
      outboundLeased: row.outbound_leased,
      outboundSent: row.outbound_sent,
      outboundRetryableFailed: row.outbound_retryable_failed,
      outboundDeadLetter: row.outbound_dead_letter,
      outboundReconciliation: row.outbound_reconciliation,
      campaignQueued: row.campaign_queued,
      campaignLeased: row.campaign_leased,
      campaignSent: row.campaign_sent,
      campaignRetryableFailed: row.campaign_retryable_failed,
      campaignDeadLetter: row.campaign_dead_letter,
      campaignReconciliation: row.campaign_reconciliation,
    };
  } catch {
    return { state: "unavailable" as const };
  }
}

export async function readLineOperationsHealth(
  variables: Record<string, string | undefined> = process.env,
) {
  const sql = await adminSql(variables);
  if (!sql) return { state: "not_ready" as const };
  try {
    const row = opsHealthSchema.array().parse(await sql.query("SELECT * FROM private_line.admin_read_line_ops_health()", []))[0];
    if (!row) return { state: "unavailable" as const };
    return {
      state: "ready" as const,
      outboundQueued: row.outbound_queued,
      outboundFailed: row.outbound_failed,
      outboundReconciliation: row.outbound_reconciliation,
      campaignQueued: row.campaign_queued,
      campaignReconciliation: row.campaign_reconciliation,
      privacyPending: row.privacy_pending,
      businessEventCount: row.business_event_count,
      latestBusinessEventAt: iso(row.latest_business_event_at),
      retentionMode: row.retention_mode,
      automaticDeleteEnabled: row.automatic_delete_enabled,
    };
  } catch {
    return { state: "unavailable" as const };
  }
}
