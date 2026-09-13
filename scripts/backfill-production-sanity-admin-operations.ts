import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { createClient } from "@sanity/client";
import { neon } from "@neondatabase/serverless";
import {
  ADMIN_OPERATIONS_PRODUCTION_MIGRATION_CHECKSUM,
  ADMIN_OPERATIONS_PRODUCTION_MIGRATION_VERSION,
} from "../lib/admin/operations/foundation";
import { prepareBackfillInsert } from "./backfill-sanity-admin-operations";

const SOURCE = { projectId: "kyfxgjnq", dataset: "production" } as const;
const TARGET = {
  projectId: "lively-bar-43618798",
  branchId: "br-long-resonance-b3ys5xrv",
  endpointId: "ep-broad-butterfly-b3ro7u8w",
  hostSuffix: "c-4.ap-southeast-1.aws.neon.tech",
  database: "neondb",
} as const;
const apply = process.argv.includes("--apply");
const expectedDigestArg = process.argv.find((value) => value.startsWith("--expect-source-digest="));
const expectedSourceDigest = expectedDigestArg?.slice("--expect-source-digest=".length) || null;

type SourceDocument = Record<string, unknown> & {
  _id: string;
  _rev: string;
  _type: string;
};

type Prepared = ReturnType<typeof prepareBackfillInsert>;

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hash(value: unknown) {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

function adaptSourceLineage(document: SourceDocument): Prepared {
  const prepared = prepareBackfillInsert(document as Parameters<typeof prepareBackfillInsert>[0]);
  if (prepared.params.length < 5) throw new Error(`Unexpected prepared row shape for ${document._id}`);
  const lineageTail = prepared.params.slice(-3);
  return {
    ...prepared,
    params: [
      ...prepared.params.slice(0, -5),
      SOURCE.projectId,
      SOURCE.dataset,
      ...lineageTail,
    ],
  };
}

const atomicLineageGuardQuery = `WITH expected AS (
    SELECT * FROM jsonb_to_recordset($1::jsonb) AS expected_row(
      type text, source_document_id text, source_revision text, source_hash_sha256 text
    )
  ), actual AS (
    SELECT 'auditLog'::text AS type,source_document_id,source_revision,source_hash_sha256
      FROM ccpun_admin.audit_log WHERE source_project_id=$2 AND source_dataset=$3
    UNION ALL SELECT 'researchSnapshot',source_document_id,source_revision,source_hash_sha256
      FROM ccpun_admin.research_snapshot WHERE source_project_id=$2 AND source_dataset=$3
    UNION ALL SELECT 'seoSuggestion',source_document_id,source_revision,source_hash_sha256
      FROM ccpun_admin.seo_suggestion WHERE source_project_id=$2 AND source_dataset=$3
  )
  SELECT 1 / CASE WHEN
    (SELECT count(*) FROM expected) = (SELECT count(*) FROM actual)
    AND NOT EXISTS (
      SELECT 1 FROM expected
      LEFT JOIN actual USING (type,source_document_id,source_revision,source_hash_sha256)
      WHERE actual.source_document_id IS NULL
    )
  THEN 1 ELSE 0 END AS atomic_lineage_ok`;

async function main() {
  const token = process.env.SANITY_API_READ_TOKEN?.trim();
  if (!token) throw new Error("SANITY_API_READ_TOKEN is required; no write-token fallback is allowed");

  const configuredProject = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID?.trim() || SOURCE.projectId;
  const configuredDataset = process.env.NEXT_PUBLIC_SANITY_DATASET?.trim() || SOURCE.dataset;
  if (configuredProject !== SOURCE.projectId || configuredDataset !== SOURCE.dataset) {
    throw new Error("Source must be kyfxgjnq/production");
  }

  const sanity = createClient({
    projectId: SOURCE.projectId,
    dataset: SOURCE.dataset,
    token,
    apiVersion: "2026-08-20",
    useCdn: false,
    perspective: "raw",
  });
  const documents = await sanity.fetch<SourceDocument[]>(
    `*[_type in ["auditLog","researchSnapshot","seoSuggestion"]] | order(_type asc, _id asc)`,
  );
  const prepared = documents.map(adaptSourceLineage);
  const counts = Object.fromEntries(
    ["auditLog", "researchSnapshot", "seoSuggestion"].map((type) => [type, documents.filter((doc) => doc._type === type).length]),
  );
  const sourceDigest = hash(prepared.map((row) => `${row.lineage.type}:${row.lineage.source_document_id}:${row.lineage.source_revision}:${row.lineage.source_hash_sha256}`));

  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    source: SOURCE,
    target: TARGET,
    counts,
    sourceDigest,
    prevalidatedRows: prepared.length,
  }, null, 2));

  if (!apply) return;
  if (!expectedSourceDigest || expectedSourceDigest !== sourceDigest) {
    throw new Error(`--apply requires --expect-source-digest=${sourceDigest}`);
  }
  if (process.env.CCPUN_APP_ENV !== "local-production") {
    throw new Error("--apply requires CCPUN_APP_ENV=local-production");
  }
  if (
    process.env.CCPUN_NEON_PROJECT_ID !== TARGET.projectId
    || process.env.CCPUN_NEON_BRANCH_ID !== TARGET.branchId
    || process.env.CCPUN_NEON_DATABASE !== TARGET.database
  ) {
    throw new Error("Neon identity mismatch; expected Production Admin project/branch/database");
  }

  const connectionString = process.env.CCPUN_ADMIN_BACKFILL_DATABASE_URL?.trim();
  if (!connectionString) throw new Error("CCPUN_ADMIN_BACKFILL_DATABASE_URL is required");
  const url = new URL(connectionString);
  const endpointHosts = new Set([
    `${TARGET.endpointId}.${TARGET.hostSuffix}`,
    `${TARGET.endpointId}-pooler.${TARGET.hostSuffix}`,
  ]);
  if (url.protocol !== "postgresql:" || !endpointHosts.has(url.hostname)) {
    throw new Error("Backfill URL must use the exact Production Admin Neon endpoint");
  }
  if (decodeURIComponent(url.pathname.slice(1)) !== TARGET.database || url.searchParams.get("sslmode") !== "require") {
    throw new Error("Backfill URL database or SSL mode mismatch");
  }
  if (!["neondb_owner", "cloud_admin"].includes(decodeURIComponent(url.username))) {
    throw new Error("Backfill requires an owner role and refuses ccpun_admin_runtime");
  }

  const sql = neon(connectionString, { fetchOptions: { signal: AbortSignal.timeout(10_000) } });
  const identity = await sql.query(
    `SELECT current_database() AS database_name,current_user AS role_name,
       EXISTS (SELECT 1 FROM ccpun_admin.schema_migration WHERE version=$1 AND checksum=$2) AS ledger_current,
       EXISTS (SELECT 1 FROM ccpun_admin.system_identity WHERE singleton=true AND project_id=$3 AND branch_id=$4
         AND endpoint_id=$5 AND database_name=$6 AND migration_version=$1 AND migration_checksum=$2) AS identity_current,
       EXISTS (SELECT 1 FROM information_schema.role_table_grants WHERE grantee='ccpun_admin_runtime'
         AND table_schema='ccpun_admin' AND table_name='article_schedule' AND privilege_type='SELECT') AS scheduler_grants_preserved`,
    [
      ADMIN_OPERATIONS_PRODUCTION_MIGRATION_VERSION,
      ADMIN_OPERATIONS_PRODUCTION_MIGRATION_CHECKSUM,
      TARGET.projectId,
      TARGET.branchId,
      TARGET.endpointId,
      TARGET.database,
    ],
  ) as Array<{ database_name: string; role_name: string; ledger_current: boolean; identity_current: boolean; scheduler_grants_preserved: boolean }>;
  const identityRow = identity[0];
  if (
    !identityRow
    || identityRow.database_name !== TARGET.database
    || !["neondb_owner", "cloud_admin"].includes(identityRow.role_name)
    || !identityRow.ledger_current
    || !identityRow.identity_current
    || !identityRow.scheduler_grants_preserved
  ) {
    throw new Error("Production migration identity/readback mismatch");
  }

  await sql.transaction((transaction) => [
    ...prepared.map((row) => transaction.query(row.query, row.params)),
    transaction.query(atomicLineageGuardQuery, [
      JSON.stringify(prepared.map((row) => row.lineage)),
      SOURCE.projectId,
      SOURCE.dataset,
    ]),
  ], { isolationLevel: "Serializable" });

  const postflight = await sql.query(
    `SELECT 'auditLog' AS type,count(*)::int AS count FROM ccpun_admin.audit_log WHERE source_project_id=$1 AND source_dataset=$2
     UNION ALL SELECT 'researchSnapshot',count(*)::int FROM ccpun_admin.research_snapshot WHERE source_project_id=$1 AND source_dataset=$2
     UNION ALL SELECT 'seoSuggestion',count(*)::int FROM ccpun_admin.seo_suggestion WHERE source_project_id=$1 AND source_dataset=$2`,
    [SOURCE.projectId, SOURCE.dataset],
  ) as Array<{ type: string; count: number }>;
  const targetCounts = Object.fromEntries(postflight.map((row) => [row.type, row.count]));
  for (const [type, sourceCount] of Object.entries(counts)) {
    if (targetCounts[type] !== sourceCount) throw new Error(`Postflight count mismatch for ${type}`);
  }

  console.log(JSON.stringify({
    applied: true,
    targetCounts,
    sourceDigest,
    rollback: "Legacy Sanity operational records remain preserved; disable the Production Admin database runtime to fail closed.",
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Production backfill failed");
    process.exitCode = 1;
  });
}
