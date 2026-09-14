import "server-only";

import { z } from "zod";

const REPOSITORY = "punniix/CCPun-Update-4.0";
const ADMIN_ENVIRONMENT = "Production – ccpun-admin";
const GITHUB_API = `https://api.github.com/repos/${REPOSITORY}`;

const deploymentSchema = z.object({
  id: z.number().int().positive(),
  environment: z.string(),
  sha: z.string().regex(/^[0-9a-f]{40}$/),
  ref: z.string(),
  created_at: z.string().datetime(),
  statuses_url: z.string().url(),
});

const deploymentStatusSchema = z.object({
  state: z.enum(["error", "failure", "inactive", "in_progress", "queued", "pending", "success"]),
  description: z.string().nullable().optional(),
  environment_url: z.string().url().nullable().optional(),
  target_url: z.string().url().nullable().optional(),
  created_at: z.string().datetime(),
});

export type DeploymentHistoryItem = {
  id: number;
  sha: string;
  ref: string;
  state: z.infer<typeof deploymentStatusSchema>["state"] | "unknown";
  createdAt: string;
  deploymentUrl: string | null;
  description: string | null;
  isCurrentSha: boolean;
};

export type DeploymentReadModel = {
  status: "ready" | "partial" | "unavailable";
  canonicalHost: string;
  requestHost: string | null;
  canonicalHostMatched: boolean;
  vercelEnvironment: string | null;
  gitBranch: string | null;
  gitSha: string | null;
  region: string | null;
  projectProductionUrl: string | null;
  latestProduction: DeploymentHistoryItem | null;
  exactShaProduction: DeploymentHistoryItem | null;
  history: DeploymentHistoryItem[];
  source: string;
  error: string | null;
};

function safeHost(value: string | null | undefined) {
  const host = value?.trim().toLowerCase().split(":", 1)[0];
  return host && /^[a-z0-9.-]{1,253}$/.test(host) ? host : null;
}

async function githubJson(url: string) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "ccpun-admin-control-plane",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    next: { revalidate: 60 },
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`github-${response.status}`);
  return response.json() as Promise<unknown>;
}

async function statusForDeployment(statusesUrl: string) {
  const statuses = z.array(deploymentStatusSchema).parse(await githubJson(statusesUrl));
  return statuses[0] ?? null;
}

export async function readAdminDeployments(
  requestHost: string | null,
  env: Record<string, string | undefined> = process.env,
): Promise<DeploymentReadModel> {
  const canonicalHost = "admin.ccpun.com";
  const host = safeHost(requestHost);
  const gitSha = env.VERCEL_GIT_COMMIT_SHA?.trim() || null;
  const base = {
    canonicalHost,
    requestHost: host,
    canonicalHostMatched: host === canonicalHost,
    vercelEnvironment: env.VERCEL_ENV?.trim() || null,
    gitBranch: env.VERCEL_GIT_COMMIT_REF?.trim() || null,
    gitSha,
    region: env.VERCEL_REGION?.trim() || null,
    projectProductionUrl: safeHost(env.VERCEL_PROJECT_PRODUCTION_URL) || null,
    source: "Vercel system environment + GitHub deployment metadata",
  };

  try {
    const raw = z.array(deploymentSchema).parse(await githubJson(`${GITHUB_API}/deployments?per_page=40`));
    const adminDeployments = raw.filter((deployment) => deployment.environment === ADMIN_ENVIRONMENT).slice(0, 8);
    const history = await Promise.all(adminDeployments.map(async (deployment): Promise<DeploymentHistoryItem> => {
      const status = await statusForDeployment(deployment.statuses_url).catch(() => null);
      return {
        id: deployment.id,
        sha: deployment.sha,
        ref: deployment.ref,
        state: status?.state ?? "unknown",
        createdAt: status?.created_at ?? deployment.created_at,
        deploymentUrl: status?.environment_url ?? status?.target_url ?? null,
        description: status?.description ?? null,
        isCurrentSha: Boolean(gitSha && deployment.sha === gitSha),
      };
    }));
    const successful = history.filter((item) => item.state === "success");
    const latestProduction = successful[0] ?? null;
    const exactShaProduction = gitSha ? successful.find((item) => item.sha === gitSha) ?? null : null;
    const runtimeLooksProduction = base.vercelEnvironment === "production" && base.gitBranch === "v4-production";
    const status: DeploymentReadModel["status"] = runtimeLooksProduction && exactShaProduction && base.canonicalHostMatched
      ? "ready"
      : history.length ? "partial" : "unavailable";
    return { ...base, status, latestProduction, exactShaProduction, history, error: null };
  } catch (error) {
    return {
      ...base,
      status: base.vercelEnvironment === "production" && base.gitBranch === "v4-production" ? "partial" : "unavailable",
      latestProduction: null,
      exactShaProduction: null,
      history: [],
      error: error instanceof Error ? error.message : "deployment-reader-failed",
    };
  }
}
