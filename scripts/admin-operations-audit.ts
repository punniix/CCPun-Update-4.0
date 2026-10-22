import { neon } from "@neondatabase/serverless";
import { safeAuditJson } from "../lib/admin/audit-sanitizer";
import {
  ADMIN_OPERATIONS_IDENTITY,
  ADMIN_OPERATIONS_LANES,
  ADMIN_OPERATIONS_MIGRATION_CHECKSUM,
  ADMIN_OPERATIONS_MIGRATION_VERSION,
  isAdminOperationsRuntimeIdentityValid,
} from "../lib/admin/operations/foundation";

type EnvironmentInput = Record<string, string | undefined>;

async function scriptAdminAuditSql(environment: EnvironmentInput) {
  const connectionString = environment.CCPUN_ADMIN_DATABASE_URL?.trim();
  if (!isAdminOperationsRuntimeIdentityValid({
    environment: environment.CCPUN_APP_ENV?.trim(), projectId: environment.CCPUN_NEON_PROJECT_ID?.trim(),
    branchId: environment.CCPUN_NEON_BRANCH_ID?.trim(), database: environment.CCPUN_NEON_DATABASE?.trim(), connectionString,
  })) throw new Error("Neon Admin audit is not configured for the exact UAT lane");
  const sql = neon(connectionString!, { fetchOptions: { signal: AbortSignal.timeout(5_000) } });
  const identity = await sql.query(
    `SELECT current_database() AS database_name,current_user AS role_name,
       EXISTS (SELECT 1 FROM ccpun_admin.system_identity WHERE singleton=true AND project_id=$1 AND branch_id=$2
         AND database_name=$3 AND migration_version=$4 AND migration_checksum=$5) AS identity_current,
       EXISTS (SELECT 1 FROM ccpun_admin.schema_migration WHERE version=$4 AND checksum=$5) AS ledger_current`,
    [ADMIN_OPERATIONS_IDENTITY.projectId,ADMIN_OPERATIONS_IDENTITY.branchId,ADMIN_OPERATIONS_IDENTITY.database,
      ADMIN_OPERATIONS_MIGRATION_VERSION,ADMIN_OPERATIONS_MIGRATION_CHECKSUM],
  ) as Array<{ database_name: string; role_name: string; identity_current: boolean; ledger_current: boolean }>;
  const row = identity[0];
  if (!row || row.database_name !== ADMIN_OPERATIONS_IDENTITY.database || row.role_name !== ADMIN_OPERATIONS_IDENTITY.runtimeRole
    || !row.identity_current || !row.ledger_current) throw new Error("Neon Admin audit identity mismatch");
  return sql;
}

export async function appendScriptAdminAudit(input: {
  id: string; action: string; objectId: string; requestId: string; timestamp: string;
  before?: unknown; after?: unknown;
}, environment: EnvironmentInput = process.env) {
  const sql = await scriptAdminAuditSql(environment);
  const before = safeAuditJson(input.before);
  const after = safeAuditJson(input.after);
  await sql.query(
    `INSERT INTO ccpun_admin.audit_log
      (id,actor,actor_type,action,object_type,object_id,before_json,after_json,request_id,environment,occurred_at)
     VALUES ($1,'taxonomy-migration','system',$2,'article-batch',$3,$4::jsonb,$5::jsonb,$6::uuid,'admin-uat',$7::timestamptz)
     ON CONFLICT (id) DO NOTHING`,
    [input.id,input.action,input.objectId,before ?? null,after ?? null,input.requestId,input.timestamp],
  );
}


/** Read-only interlock. An unresolved intent requires an authorized operator to
 * compare the original audit/request identity with Sanity transaction evidence.
 * This CLI never infers its own commit from matching content, clears the intent,
 * rolls back CMS data, or retries a CMS write to repair an audit failure. */
export async function assertNoPendingScriptAdminAudit(environment: EnvironmentInput = process.env) {
  const uat = ADMIN_OPERATIONS_LANES.uat;
  if (!["local-uat", "admin-uat"].includes(environment.CCPUN_APP_ENV?.trim() ?? "")
    || environment.CCPUN_NEON_PROJECT_ID?.trim() !== uat.projectId
    || environment.CCPUN_NEON_BRANCH_ID?.trim() !== uat.branchId
    || environment.CCPUN_NEON_DATABASE?.trim() !== uat.database
    || ADMIN_OPERATIONS_IDENTITY.projectId !== uat.projectId) {
    throw new Error("UAT_TAXONOMY_AUDIT_TARGET_DENIED");
  }
  const sql = await scriptAdminAuditSql(environment);
  const rows = await sql.query(
    `SELECT EXISTS (
       SELECT 1 FROM ccpun_admin.audit_log intent
       WHERE intent.actor=$1 AND intent.actor_type='system' AND intent.environment='admin-uat'
         AND intent.object_type='article-batch' AND intent.action=$2 AND intent.id LIKE $3
         AND NOT EXISTS (
           SELECT 1 FROM ccpun_admin.audit_log success
           WHERE success.id=left(intent.id,length(intent.id)-length('.intent')) || '.success'
             AND success.actor=intent.actor AND success.actor_type=intent.actor_type
             AND success.environment=intent.environment AND success.object_type=intent.object_type
             AND success.object_id=intent.object_id AND success.request_id=intent.request_id
             AND success.action=$4
         )
     ) AS pending`,
    ['taxonomy-migration','uat-taxonomy:normalize-intent','auditLog.uat-taxonomy-%.intent','uat-taxonomy:normalize-success'],
  ) as Array<{ pending: boolean }>;
  if (rows.length !== 1 || rows[0]?.pending !== false) {
    throw new Error("UAT_TAXONOMY_RECONCILIATION_REQUIRED");
  }
}
