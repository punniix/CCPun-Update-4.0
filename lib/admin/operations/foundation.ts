export const ADMIN_OPERATIONS_MIGRATION_VERSION = "20260830_website_42_admin_operations_v1";
export const ADMIN_OPERATIONS_MIGRATION_CHECKSUM = "sha256:51f16b563368488362408f323f95863ecf8f277b6b725b96189fedddf1300e4f";
export const ADMIN_OPERATIONS_PRODUCTION_MIGRATION_VERSION = "20260913_admin_operations_production_v1";
export const ADMIN_OPERATIONS_PRODUCTION_MIGRATION_CHECKSUM = "sha256:5895b0882bf199c2017e761b15d87cac5a94bab44c5c832f68fa2b3cf385ac51";

export const ADMIN_OPERATIONS_LANES = {
  uat: {
    projectId: "young-term-47483330",
    branchId: "br-crimson-mouse-az7ajkv8",
    endpointId: "ep-mute-frost-aztvz394",
    hostSuffix: "c-3.ap-southeast-1.aws.neon.tech",
    database: "neondb",
    runtimeRole: "ccpun_admin_runtime",
    migrationVersion: ADMIN_OPERATIONS_MIGRATION_VERSION,
    migrationChecksum: ADMIN_OPERATIONS_MIGRATION_CHECKSUM,
  },
  production: {
    projectId: "lively-bar-43618798",
    branchId: "br-long-resonance-b3ys5xrv",
    endpointId: "ep-broad-butterfly-b3ro7u8w",
    hostSuffix: "c-4.ap-southeast-1.aws.neon.tech",
    database: "neondb",
    runtimeRole: "ccpun_admin_runtime",
    migrationVersion: ADMIN_OPERATIONS_PRODUCTION_MIGRATION_VERSION,
    migrationChecksum: ADMIN_OPERATIONS_PRODUCTION_MIGRATION_CHECKSUM,
  },
} as const;

export type AdminOperationsLane = keyof typeof ADMIN_OPERATIONS_LANES;
export type AdminOperationsIdentity = (typeof ADMIN_OPERATIONS_LANES)[AdminOperationsLane];

// Backwards-compatible UAT identity for UAT-only migration/backfill tooling.
export const ADMIN_OPERATIONS_IDENTITY = ADMIN_OPERATIONS_LANES.uat;

export type AdminOperationsRuntimeIdentity = {
  environment: string | undefined;
  projectId: string | undefined;
  branchId: string | undefined;
  database: string | undefined;
  connectionString: string | undefined;
  vercelEnvironment?: string | undefined;
  gitBranch?: string | undefined;
  vercelProjectId?: string | undefined;
  productionAdminProjectId?: string | undefined;
};

export type ResolvedAdminOperationsRuntime = {
  lane: AdminOperationsLane;
  environment: "admin-uat" | "local-uat" | "production-admin";
  identity: AdminOperationsIdentity;
};

export function resolveAdminOperationsRuntimeIdentity(input: AdminOperationsRuntimeIdentity): ResolvedAdminOperationsRuntime | null {
  const environment = input.environment?.trim();
  const lane: AdminOperationsLane | null = environment === "production-admin"
    ? "production"
    : environment === "admin-uat" || environment === "local-uat"
      ? "uat"
      : null;
  if (!lane || !input.connectionString) return null;

  if (lane === "production") {
    if (input.vercelEnvironment !== "production" || input.gitBranch !== "v4-production") return null;
    if (input.productionAdminProjectId && input.vercelProjectId !== input.productionAdminProjectId) return null;
  } else if (environment === "admin-uat" && input.vercelEnvironment && input.vercelEnvironment !== "preview") {
    return null;
  }

  const identity = ADMIN_OPERATIONS_LANES[lane];
  if (input.projectId !== identity.projectId || input.branchId !== identity.branchId || input.database !== identity.database) return null;

  try {
    const url = new URL(input.connectionString);
    const allowedHosts = new Set([
      `${identity.endpointId}.${identity.hostSuffix}`,
      `${identity.endpointId}-pooler.${identity.hostSuffix}`,
    ]);
    if (url.protocol !== "postgresql:" || !allowedHosts.has(url.hostname) || url.port || url.hash) return null;
    if (decodeURIComponent(url.username) !== identity.runtimeRole || !url.password) return null;
    if (decodeURIComponent(url.pathname.slice(1)) !== identity.database || url.searchParams.get("sslmode") !== "require") return null;
    return { lane, environment: environment as ResolvedAdminOperationsRuntime["environment"], identity };
  } catch {
    return null;
  }
}

export function isAdminOperationsRuntimeIdentityValid(input: AdminOperationsRuntimeIdentity) {
  return resolveAdminOperationsRuntimeIdentity(input) !== null;
}

export function adminOperationsRuntimeInputFromEnvironment(
  variables: Record<string, string | undefined> = process.env,
): AdminOperationsRuntimeIdentity {
  return {
    environment: variables.CCPUN_APP_ENV?.trim(),
    projectId: variables.CCPUN_NEON_PROJECT_ID?.trim(),
    branchId: variables.CCPUN_NEON_BRANCH_ID?.trim(),
    database: variables.CCPUN_NEON_DATABASE?.trim(),
    connectionString: variables.CCPUN_ADMIN_DATABASE_URL?.trim(),
    vercelEnvironment: variables.VERCEL_ENV?.trim(),
    gitBranch: variables.VERCEL_GIT_COMMIT_REF?.trim(),
    vercelProjectId: variables.VERCEL_PROJECT_ID?.trim(),
    productionAdminProjectId: variables.CCPUN_PRODUCTION_ADMIN_VERCEL_PROJECT_ID?.trim(),
  };
}

export function getAdminOperationsRuntimeStatus(
  variables: Record<string, string | undefined> = process.env,
) {
  const input = adminOperationsRuntimeInputFromEnvironment(variables);
  const resolved = resolveAdminOperationsRuntimeIdentity(input);
  return {
    environment: input.environment ?? null,
    configured: Boolean(input.connectionString),
    identityValid: Boolean(resolved),
    lane: resolved?.lane ?? null,
    projectId: input.projectId ?? null,
    branchId: input.branchId ?? null,
    database: input.database ?? null,
    migrationVersion: resolved?.identity.migrationVersion ?? null,
  };
}
