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
  lead_count: z.coerce.number().int().nonnegative(),
  material_received_count: z.coerce.number().int().nonnegative(),
  qualified_count: z.coerce.number().int().nonnegative(),
  implementation_complete_count: z.coerce.number().int().nonnegative(),
  won_count: z.coerce.number().int().nonnegative(),
  revenue_record_count: z.coerce.number().int().nonnegative(),
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
  if (!sql) return { state: "not_ready" as const, summary: null, revenue: [], content: [] };
  try {
    const [summaryRows, revenueRows, contentRows] = await Promise.all([
      sql.query("SELECT * FROM private_line.admin_read_conversion_summary()", []),
      sql.query("SELECT currency,revenue_minor,revenue_record_count FROM private_line.admin_read_revenue_by_currency()", []),
      sql.query(
        "SELECT origin,journey,content_id,campaign_id,tool_id,lead_count,material_received_count,qualified_count,implementation_complete_count,won_count,revenue_record_count FROM private_line.admin_read_content_intelligence($1::integer)",
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
        leadCount: row.lead_count,
        materialReceivedCount: row.material_received_count,
        qualifiedCount: row.qualified_count,
        implementationCompleteCount: row.implementation_complete_count,
        wonCount: row.won_count,
        revenueRecordCount: row.revenue_record_count,
      })),
    };
  } catch {
    return { state: "unavailable" as const, summary: null, revenue: [], content: [] };
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
  return {
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
