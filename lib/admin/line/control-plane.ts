import "server-only";

import { neon } from "@neondatabase/serverless";
import { z } from "zod";
import {
  adminOperationsRuntimeInputFromEnvironment,
  resolveAdminOperationsRuntimeIdentity,
  type AdminOperationsLane,
} from "../operations/foundation";

export const LINE_ADVISOR_INBOX_STAGES = [
  "New",
  "Qualified",
  "Expert Review",
  "Solution",
  "Quote",
  "Implementation",
  "Won",
  "Lost",
] as const;

export type LineAdvisorInboxStage = (typeof LINE_ADVISOR_INBOX_STAGES)[number];

const lineAdvisorInboxRowSchema = z.object({
  lead_id: z.string().uuid(),
  advisor_case_id: z.string().uuid().nullable(),
  customer_code: z.string().regex(/^C[0-9A-F]{32}$/),
  stage: z.enum(LINE_ADVISOR_INBOX_STAGES),
  journey: z.string().min(1).max(80),
  material_received: z.boolean(),
  conversation_status: z.enum(["open", "closed"]),
  unread_count: z.coerce.number().int().nonnegative(),
  last_activity_at: z.union([z.string(), z.date()]).nullable(),
  priority: z.enum(["low", "normal", "high", "urgent"]).nullable(),
  assigned_advisor: z.string().max(200).nullable(),
  latest_message_type: z.enum(["text", "image", "video", "audio", "file", "location", "sticker"]).nullable(),
  latest_message_status: z.enum(["active", "unsent", "delivery_pending", "sent", "failed"]).nullable(),
  latest_message_needs_human: z.boolean().nullable(),
  updated_at: z.union([z.string(), z.date()]),
});

type LineAdvisorInboxDbRow = z.infer<typeof lineAdvisorInboxRowSchema>;

export type LineAdvisorInboxSafeItem = {
  leadId: string;
  advisorCaseId: string | null;
  customerCode: string;
  stage: LineAdvisorInboxStage;
  journey: string;
  materialReceived: boolean;
  conversationStatus: "open" | "closed";
  unreadCount: number;
  lastActivityAt: string | null;
  priority: "low" | "normal" | "high" | "urgent" | null;
  assignedAdvisor: string | null;
  latestMessageType: "text" | "image" | "video" | "audio" | "file" | "location" | "sticker" | null;
  latestMessageStatus: "active" | "unsent" | "delivery_pending" | "sent" | "failed" | null;
  latestMessageNeedsHuman: boolean | null;
  updatedAt: string;
};

export type LineAdvisorInboxStatus = {
  databaseConfigured: boolean;
  databaseIdentityValid: boolean;
  lane: AdminOperationsLane | null;
  viewReady: boolean;
  rawCustomerDataExposedToClient: false;
  transcriptEnabled: false;
  replyEnabled: false;
  stageMutationEnabled: false;
};

export type LineAdvisorInboxReadModel = {
  status: LineAdvisorInboxStatus;
  rows: LineAdvisorInboxSafeItem[];
  aggregate: {
    openCases: number;
    needsHuman: number;
    materialReceived: number;
    stageCounts: Record<LineAdvisorInboxStage, number>;
  };
  unavailableReason: "admin_runtime_not_ready" | "safe_view_not_ready" | "safe_view_read_failed" | null;
};

function iso(value: string | Date | null): string | null {
  return value instanceof Date ? value.toISOString() : value;
}

export function resolveLineAdvisorInboxRuntime(
  variables: Record<string, string | undefined> = process.env,
) {
  return resolveAdminOperationsRuntimeIdentity(adminOperationsRuntimeInputFromEnvironment(variables));
}

function baseStatus(
  variables: Record<string, string | undefined>,
  viewReady: boolean,
): LineAdvisorInboxStatus {
  const runtime = resolveLineAdvisorInboxRuntime(variables);
  return {
    databaseConfigured: Boolean(variables.CCPUN_ADMIN_DATABASE_URL?.trim()),
    databaseIdentityValid: Boolean(runtime),
    lane: runtime?.lane ?? null,
    viewReady,
    rawCustomerDataExposedToClient: false,
    transcriptEnabled: false,
    replyEnabled: false,
    stageMutationEnabled: false,
  };
}

function emptyStageCounts(): Record<LineAdvisorInboxStage, number> {
  return Object.fromEntries(LINE_ADVISOR_INBOX_STAGES.map((stage) => [stage, 0])) as Record<LineAdvisorInboxStage, number>;
}

function aggregateRows(rows: LineAdvisorInboxSafeItem[]): LineAdvisorInboxReadModel["aggregate"] {
  const aggregate: LineAdvisorInboxReadModel["aggregate"] = {
    openCases: 0,
    needsHuman: 0,
    materialReceived: 0,
    stageCounts: emptyStageCounts(),
  };
  for (const row of rows) {
    if (row.stage !== "Won" && row.stage !== "Lost") aggregate.openCases += 1;
    if (row.latestMessageNeedsHuman) aggregate.needsHuman += 1;
    if (row.materialReceived) aggregate.materialReceived += 1;
    aggregate.stageCounts[row.stage] += 1;
  }
  return aggregate;
}

function normalizeRow(row: LineAdvisorInboxDbRow): LineAdvisorInboxSafeItem {
  return {
    leadId: row.lead_id,
    advisorCaseId: row.advisor_case_id,
    customerCode: row.customer_code,
    stage: row.stage,
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
  };
}

export async function listAdvisorInboxSafe(
  limit = 50,
  variables: Record<string, string | undefined> = process.env,
): Promise<LineAdvisorInboxReadModel> {
  const runtime = resolveLineAdvisorInboxRuntime(variables);
  const connectionString = variables.CCPUN_ADMIN_DATABASE_URL?.trim();
  if (!runtime || !connectionString) {
    return {
      status: baseStatus(variables, false),
      rows: [],
      aggregate: aggregateRows([]),
      unavailableReason: "admin_runtime_not_ready",
    };
  }

  try {
    const sql = neon(connectionString, { fetchOptions: { signal: AbortSignal.timeout(5_000) } });
    const readiness = await sql.query(
      `SELECT current_database() AS database_name,
              current_user AS role_name,
              to_regclass('private_line.advisor_inbox_safe')::text AS safe_view,
              has_schema_privilege(current_user, 'private_line', 'USAGE') AS schema_usage,
              CASE
                WHEN to_regclass('private_line.advisor_inbox_safe') IS NULL THEN false
                ELSE has_table_privilege(current_user, 'private_line.advisor_inbox_safe', 'SELECT')
              END AS can_read_view`,
      [],
    ) as Array<{
      database_name: string;
      role_name: string;
      safe_view: string | null;
      schema_usage: boolean;
      can_read_view: boolean;
    }>;
    const ready = readiness[0];
    const viewReady = Boolean(
      ready &&
      ready.database_name === runtime.identity.database &&
      ready.role_name === runtime.identity.runtimeRole &&
      ready.safe_view === "private_line.advisor_inbox_safe" &&
      ready.schema_usage &&
      ready.can_read_view,
    );
    if (!viewReady) {
      return {
        status: baseStatus(variables, false),
        rows: [],
        aggregate: aggregateRows([]),
        unavailableReason: "safe_view_not_ready",
      };
    }

    const boundedLimit = Math.max(1, Math.min(100, Math.floor(limit)));
    const rows = z.array(lineAdvisorInboxRowSchema).parse(await sql.query(
      `SELECT lead_id::text, advisor_case_id::text, customer_code, stage, journey,
              material_received, conversation_status, unread_count, last_activity_at,
              priority, assigned_advisor, latest_message_type, latest_message_status,
              latest_message_needs_human, updated_at
       FROM private_line.advisor_inbox_safe
       ORDER BY COALESCE(last_activity_at, updated_at) DESC, updated_at DESC
       LIMIT $1`,
      [boundedLimit],
    ));
    const normalized = rows.map(normalizeRow);
    return {
      status: baseStatus(variables, true),
      rows: normalized,
      aggregate: aggregateRows(normalized),
      unavailableReason: null,
    };
  } catch {
    return {
      status: baseStatus(variables, false),
      rows: [],
      aggregate: aggregateRows([]),
      unavailableReason: "safe_view_read_failed",
    };
  }
}
