export const CCPUN_VERCEL_PROJECT_IDS = {
  web: "prj_dxwjITkd0av5QiJQv2snUlIASUWu",
  admin: "prj_6tuUxJxYbQ4mpF7sMgNWx2p2jowN",
} as const;

export const DEPLOYMENT_PROVIDERS = ["vercel", "hostinger", "local", "unknown"] as const;
export const DEPLOYMENT_ROLES = ["web", "admin", "unknown"] as const;
export const DEPLOYMENT_ENVIRONMENTS = [
  "development",
  "web-uat",
  "local-uat",
  "local-production",
  "lab",
  "uat",
  "admin-uat",
  "production-admin",
  "production",
  "unknown",
] as const;

export type DeploymentProvider = (typeof DEPLOYMENT_PROVIDERS)[number];
export type DeploymentRole = (typeof DEPLOYMENT_ROLES)[number];
export type DeploymentEnvironment = (typeof DEPLOYMENT_ENVIRONMENTS)[number];

export type DeploymentIdentity = {
  provider: DeploymentProvider;
  role: DeploymentRole;
  environment: DeploymentEnvironment;
  valid: boolean;
  reason: string | null;
  projectId: string | null;
  gitRef: string | null;
  gitSha: string | null;
  releaseId: string | null;
};

type Variables = Record<string, string | undefined>;

const ENVIRONMENTS = new Set<DeploymentEnvironment>(DEPLOYMENT_ENVIRONMENTS);

function trimmed(value: string | undefined) {
  return value?.trim() || undefined;
}

export function parseDeploymentEnvironment(value: string | undefined): DeploymentEnvironment {
  const normalized = trimmed(value)?.toLowerCase();
  return normalized && ENVIRONMENTS.has(normalized as DeploymentEnvironment)
    ? normalized as DeploymentEnvironment
    : "unknown";
}

function parseProvider(value: string | undefined): DeploymentProvider | undefined {
  const normalized = trimmed(value)?.toLowerCase();
  if (normalized === "vercel" || normalized === "hostinger" || normalized === "local") return normalized;
  return normalized ? "unknown" : undefined;
}

function parseRole(value: string | undefined): DeploymentRole | undefined {
  const normalized = trimmed(value)?.toLowerCase();
  if (normalized === "web" || normalized === "admin") return normalized;
  return normalized ? "unknown" : undefined;
}

export function roleForVercelProject(projectId: string | undefined): DeploymentRole {
  const value = trimmed(projectId);
  if (value === CCPUN_VERCEL_PROJECT_IDS.web) return "web";
  if (value === CCPUN_VERCEL_PROJECT_IDS.admin) return "admin";
  return "unknown";
}

export function inferredVercelEnvironment(
  vercelEnvironment: string | undefined,
  role: DeploymentRole,
): DeploymentEnvironment {
  const vercel = trimmed(vercelEnvironment)?.toLowerCase();
  if (vercel === "production" && role === "web") return "production";
  if (vercel === "production" && role === "admin") return "production-admin";
  if (vercel === "preview" && role === "web") return "web-uat";
  if (vercel === "preview" && role === "admin") return "admin-uat";
  if (vercel === "development") return "development";
  return "unknown";
}

function roleMatchesEnvironment(role: DeploymentRole, environment: DeploymentEnvironment) {
  if (role === "web") {
    return environment === "development"
      || environment === "web-uat"
      || environment === "local-uat"
      || environment === "local-production"
      || environment === "production";
  }
  if (role === "admin") {
    return environment === "development"
      || environment === "local-uat"
      || environment === "local-production"
      || environment === "admin-uat"
      || environment === "production-admin";
  }
  return false;
}

export function resolveDeploymentIdentity(
  variables: Variables = process.env,
  expectedRole?: Exclude<DeploymentRole, "unknown">,
): DeploymentIdentity {
  const explicitProvider = parseProvider(variables.CCPUN_DEPLOYMENT_PROVIDER);
  const explicitRole = parseRole(variables.CCPUN_DEPLOYMENT_ROLE);
  const projectId = trimmed(variables.VERCEL_PROJECT_ID);
  const vercelRole = projectId ? roleForVercelProject(projectId) : undefined;

  let provider: DeploymentProvider;
  if (projectId) {
    provider = explicitProvider && explicitProvider !== "vercel" ? "unknown" : "vercel";
  } else if (explicitProvider) {
    provider = explicitProvider;
  } else {
    provider = "local";
  }

  let role: DeploymentRole = "unknown";
  if (provider === "vercel") {
    role = vercelRole ?? "unknown";
  } else if (provider === "hostinger") {
    role = explicitRole ?? "unknown";
  } else if (provider === "local") {
    role = explicitRole ?? expectedRole ?? "unknown";
  }

  if (explicitRole && role !== "unknown" && explicitRole !== role) {
    role = "unknown";
  }

  const explicitEnvironment = trimmed(variables.CCPUN_APP_ENV);
  const environment = explicitEnvironment
    ? parseDeploymentEnvironment(explicitEnvironment)
    : provider === "vercel"
      ? inferredVercelEnvironment(variables.VERCEL_ENV, role)
      : provider === "local"
        ? "development"
        : "unknown";

  const gitRef = trimmed(variables.CCPUN_GIT_REF) ?? trimmed(variables.VERCEL_GIT_COMMIT_REF) ?? null;
  const gitSha = trimmed(variables.CCPUN_GIT_SHA) ?? trimmed(variables.VERCEL_GIT_COMMIT_SHA) ?? null;
  const releaseId = trimmed(variables.CCPUN_RELEASE_ID)
    ?? gitSha
    ?? trimmed(variables.VERCEL_URL)
    ?? null;

  let reason: string | null = null;

  if (provider === "unknown") reason = "provider-conflict";
  else if (role === "unknown") reason = "role-unknown";
  else if (expectedRole && role !== expectedRole) reason = "role-mismatch";
  else if (environment === "unknown") reason = "environment-unknown";
  else if (!roleMatchesEnvironment(role, environment)) reason = "environment-role-mismatch";

  if (!reason && provider === "vercel") {
    if (!projectId || roleForVercelProject(projectId) !== role) reason = "vercel-project-mismatch";
    const inferred = inferredVercelEnvironment(variables.VERCEL_ENV, role);
    if (trimmed(variables.VERCEL_ENV) && inferred === "unknown") reason = "vercel-environment-unknown";
    if (
      !reason
      && explicitEnvironment
      && inferred !== "unknown"
      && environment !== inferred
      && environment !== "development"
    ) {
      reason = "vercel-environment-mismatch";
    }
  }

  if (!reason && provider === "hostinger") {
    if (!explicitProvider || explicitProvider !== "hostinger") reason = "hostinger-provider-not-explicit";
    else if (!explicitRole || explicitRole !== role) reason = "hostinger-role-not-explicit";
    else if (projectId) reason = "hostinger-vercel-project-conflict";
    else if (!explicitEnvironment) reason = "hostinger-environment-not-explicit";
    else if (!["web-uat", "admin-uat", "production", "production-admin"].includes(environment)) {
      reason = "hostinger-environment-unsupported";
    }
  }

  if (!reason && provider === "local" && projectId) reason = "local-vercel-project-conflict";

  return {
    provider,
    role,
    environment,
    valid: reason === null,
    reason,
    projectId: projectId ?? null,
    gitRef,
    gitSha,
    releaseId,
  };
}

export function isDeploymentIdentityAllowed(
  identity: DeploymentIdentity,
  role: Exclude<DeploymentRole, "unknown">,
  environment?: DeploymentEnvironment,
) {
  return identity.valid
    && identity.role === role
    && (!environment || identity.environment === environment);
}
