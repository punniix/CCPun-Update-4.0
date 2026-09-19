import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { z } from "zod";

import {
  adminOperationsRuntimeInputFromEnvironment,
  resolveAdminOperationsRuntimeIdentity,
} from "../operations/foundation";
import type { LineRichMenuProviderDefinition } from "../line/rich-menu-provider";

export const LINE_RICH_MENU_RESOURCE_KEY = "line.rich_menu.default";

const stateSchema = z.enum([
  "hold", "pending", "leased", "mutating", "verified",
  "reconciliation_required", "failed", "blocked",
]);

const resourceRowSchema = z.object({
  resource_key: z.string(),
  desired_mode: z.enum(["hold", "reconcile", "rollback"]),
  desired_version: z.string().nullable(),
  desired_hash_sha256: z.string().nullable(),
  approved_previous_version: z.string().nullable(),
  approved_previous_hash_sha256: z.string().nullable(),
  actual_version: z.string().nullable(),
  actual_hash_sha256: z.string().nullable(),
  state: stateSchema,
  row_version: z.coerce.number().int().positive(),
  last_verified_at: z.union([z.string(), z.date()]).nullable(),
  updated_at: z.union([z.string(), z.date()]),
});

const commandRowSchema = z.object({
  outcome: z.enum(["accepted", "pending_approval", "conflict", "duplicate", "idempotency_conflict", "busy"]),
  command_id: z.string().uuid(),
  resource_version: z.coerce.number().int().positive(),
});

const operationRowSchema = z.object({
  operation_id: z.string().uuid(),
  resource_key: z.string(),
  resource_version: z.coerce.number().int().positive(),
  desired_mode: z.enum(["reconcile", "rollback"]),
  desired_version: z.string().nullable(),
  desired_definition: z.unknown(),
  desired_hash_sha256: z.string().regex(/^[0-9a-f]{64}$/),
  desired_provider_ref: z.string().nullable(),
  before_actual_version: z.string().nullable(),
  before_actual_definition: z.unknown().nullable(),
  before_actual_hash_sha256: z.string().nullable(),
  before_actual_provider_ref: z.string().nullable(),
  mutation_allowed: z.boolean(),
  attempt_count: z.coerce.number().int().positive(),
});

function iso(value: string | Date | null) {
  return value instanceof Date ? value.toISOString() : value;
}

async function controlSql(variables: Record<string, string | undefined> = process.env) {
  const runtime = resolveAdminOperationsRuntimeIdentity(adminOperationsRuntimeInputFromEnvironment(variables));
  const connectionString = variables.CCPUN_ADMIN_DATABASE_URL?.trim();
  if (!runtime || !connectionString) return null;
  return neon(connectionString, { fetchOptions: { signal: AbortSignal.timeout(7_000) } });
}

export function controlPlaneDefinitionHash(definition: LineRichMenuProviderDefinition) {
  return createHash("sha256").update(JSON.stringify(definition)).digest("hex");
}

export async function readLineRichMenuControlState(
  variables: Record<string, string | undefined> = process.env,
) {
  const sql = await controlSql(variables);
  if (!sql) return null;
  const rows = resourceRowSchema.array().parse(await sql.query(
    "SELECT * FROM ccpun_admin.admin_read_control_resource($1)",
    [LINE_RICH_MENU_RESOURCE_KEY],
  ));
  const row = rows[0];
  return row ? {
    resourceKey: row.resource_key,
    desiredMode: row.desired_mode,
    desiredVersion: row.desired_version,
    desiredHash: row.desired_hash_sha256,
    approvedPreviousVersion: row.approved_previous_version,
    approvedPreviousHash: row.approved_previous_hash_sha256,
    actualVersion: row.actual_version,
    actualHash: row.actual_hash_sha256,
    state: row.state,
    rowVersion: row.row_version,
    lastVerifiedAt: iso(row.last_verified_at),
    updatedAt: iso(row.updated_at)!,
  } : null;
}

export async function submitLineRichMenuCommand(input: {
  command: "hold" | "reconcile" | "rollback";
  expectedVersion: number;
  idempotencyKey: string;
  actor: string;
  actorType: "human" | "ai" | "system";
  approvedBy?: string;
  approvalReason?: string;
  definition?: LineRichMenuProviderDefinition;
  variables?: Record<string, string | undefined>;
}) {
  const sql = await controlSql(input.variables);
  if (!sql) throw new Error("CONTROL_PLANE_NOT_CONFIGURED");
  const definition = input.command === "reconcile" ? input.definition : undefined;
  if (input.command === "reconcile" && !definition) throw new Error("CONTROL_PLANE_DEFINITION_REQUIRED");
  const payload = {
    command_id: randomUUID(),
    idempotency_key: input.idempotencyKey,
    resource_key: LINE_RICH_MENU_RESOURCE_KEY,
    command_type: input.command,
    expected_version: input.expectedVersion,
    ...(definition ? {
      requested_version: "line-rich-menu-v3",
      requested_definition: definition,
      requested_hash_sha256: controlPlaneDefinitionHash(definition),
    } : {}),
    actor: input.actor,
    actor_type: input.actorType,
    ...(input.approvedBy ? { approved_by: input.approvedBy } : {}),
    ...(input.approvalReason ? { approval_reason: input.approvalReason } : {}),
  };
  const query = () => sql.query(
    "SELECT * FROM ccpun_admin.admin_submit_control_command($1::jsonb)",
    [JSON.stringify(payload)],
  );
  let rows = commandRowSchema.array().parse(await query());
  // A concurrent request with the same idempotency key can win after this
  // statement's snapshot was created. ON CONFLICT prevents a unique error;
  // one new statement then observes and returns the durable winning command.
  if (!rows[0]) rows = commandRowSchema.array().parse(await query());
  if (!rows[0]) throw new Error("CONTROL_PLANE_COMMAND_INVALID");
  return {
    outcome: rows[0].outcome,
    commandId: rows[0].command_id,
    resourceVersion: rows[0].resource_version,
  };
}

export async function claimLineRichMenuOperation(
  variables: Record<string, string | undefined> = process.env,
) {
  const sql = await controlSql(variables);
  if (!sql) return null;
  const leaseToken = randomBytes(32).toString("hex");
  const leaseTokenDigest = createHash("sha256").update(leaseToken).digest("hex");
  const workerDigest = createHash("sha256")
    .update(`${variables.VERCEL_DEPLOYMENT_ID ?? "local"}:${variables.VERCEL_REGION ?? "unknown"}`)
    .digest("hex");
  const rows = operationRowSchema.array().parse(await sql.query(
    "SELECT * FROM ccpun_admin.admin_claim_provider_operation($1::jsonb)",
    [JSON.stringify({
      resource_key: LINE_RICH_MENU_RESOURCE_KEY,
      worker_digest: workerDigest,
      lease_token_digest: leaseTokenDigest,
    })],
  ));
  const row = rows[0];
  return row ? {
    operationId: row.operation_id,
    resourceVersion: row.resource_version,
    desiredMode: row.desired_mode,
    desiredVersion: row.desired_version,
    desiredDefinition: row.desired_definition as LineRichMenuProviderDefinition,
    desiredHash: row.desired_hash_sha256,
    desiredProviderRef: row.desired_provider_ref,
    beforeActualVersion: row.before_actual_version,
    beforeActualDefinition: row.before_actual_definition as LineRichMenuProviderDefinition | null,
    beforeActualHash: row.before_actual_hash_sha256,
    beforeActualProviderRef: row.before_actual_provider_ref,
    mutationAllowed: row.mutation_allowed,
    attemptCount: row.attempt_count,
    leaseTokenDigest,
  } : null;
}

export async function beginLineRichMenuMutation(
  operationId: string,
  leaseTokenDigest: string,
  beforeActual: {
    version: string;
    definition: LineRichMenuProviderDefinition;
    hash: string;
    providerRef: string;
  } | null,
  variables: Record<string, string | undefined> = process.env,
) {
  const sql = await controlSql(variables);
  if (!sql) return false;
  const rows = z.array(z.object({ outcome: z.enum(["ready", "rejected"]) })).parse(await sql.query(
    "SELECT * FROM ccpun_admin.admin_begin_provider_mutation($1::jsonb)",
    [JSON.stringify({
      operation_id: operationId,
      lease_token_digest: leaseTokenDigest,
      ...(beforeActual ? {
        before_actual_version: beforeActual.version,
        before_actual_definition: beforeActual.definition,
        before_actual_hash_sha256: beforeActual.hash,
        before_actual_provider_ref: beforeActual.providerRef,
      } : {}),
    })],
  ));
  return rows[0]?.outcome === "ready";
}

export async function checkpointLineRichMenuOperation(input: {
  operationId: string;
  leaseTokenDigest: string;
  outcome: "verified" | "reconciliation_required" | "failed" | "blocked";
  actual?: {
    version: string;
    definition: LineRichMenuProviderDefinition;
    hash: string;
    providerRef: string;
  };
  providerStatusCode?: number;
  errorClass?: string;
  variables?: Record<string, string | undefined>;
}) {
  const sql = await controlSql(input.variables);
  if (!sql) throw new Error("CONTROL_PLANE_NOT_CONFIGURED");
  const rows = z.array(z.object({ outcome: z.string() })).parse(await sql.query(
    "SELECT * FROM ccpun_admin.admin_checkpoint_provider_operation($1::jsonb)",
    [JSON.stringify({
      operation_id: input.operationId,
      lease_token_digest: input.leaseTokenDigest,
      outcome: input.outcome,
      ...(input.actual ? {
        actual_version: input.actual.version,
        actual_definition: input.actual.definition,
        actual_hash_sha256: input.actual.hash,
        actual_provider_ref: input.actual.providerRef,
      } : {}),
      ...(input.providerStatusCode === undefined ? {} : { provider_status_code: input.providerStatusCode }),
      ...(input.errorClass ? { error_class: input.errorClass } : {}),
    })],
  ));
  return rows[0]?.outcome ?? "stale";
}
