import { isPinnedCloudProductionRelease } from "../../runtime/hostinger-production-release.mjs";
import "server-only";

import { z } from "zod";
import { resolveDeploymentIdentity, type DeploymentProvider } from "../../runtime/deployment-identity";

const REPOSITORY = "punniix/CCPun-Update-4.0";
const GITHUB_API = `https://api.github.com/repos/${REPOSITORY}`;

const githubCheckSchema = z.object({
  name: z.string(),
  head_sha: z.string().regex(/^[0-9a-f]{40}$/),
  status: z.enum(["queued", "in_progress", "completed"]),
  conclusion: z.string().nullable(),
  completed_at: z.string().datetime().nullable(),
  app: z.object({ slug: z.string() }),
});

export type GithubCheckItem = {
  name: string;
  state: DeploymentHistoryItem["state"];
  conclusion: string | null;
  completedAt: string | null;
};

export type DeploymentHistoryItem = {
  id: number;
  sha: string;
  ref: string;
  state: "error" | "failure" | "inactive" | "in_progress" | "queued" | "pending" | "success" | "unknown";
  createdAt: string;
  deploymentUrl: string | null;
  description: string | null;
  isCurrentSha: boolean;
};

export type DeploymentReadModel = {
  status: "ready" | "partial" | "unavailable";
  provider: DeploymentProvider;
  environment: string;
  releaseId: string | null;
  runtimeIdentityValid: boolean;
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
  githubChecks: GithubCheckItem[];
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

export async function readAdminDeployments(
  requestHost: string | null,
  env: Record<string, string | undefined> = process.env,
): Promise<DeploymentReadModel> {
  const identity = resolveDeploymentIdentity(env, "admin");
  const canonicalHost = identity.environment === "admin-uat" ? "admin-test.ccpun.com" : "admin.ccpun.com";
  const host = safeHost(requestHost);
  const gitSha = identity.gitSha && /^[0-9a-f]{40}$/.test(identity.gitSha) ? identity.gitSha : null;
  const runtimeIdentityValid = identity.valid
    && ["hostinger", "local"].includes(identity.provider)
    && ["production-admin", "admin-uat"].includes(identity.environment)
    && Boolean(gitSha && identity.gitRef && /^[a-zA-Z0-9._/-]{1,128}$/.test(identity.gitRef))
    && (identity.environment !== "production-admin" || (identity.gitRef === "v4-production" || isPinnedCloudProductionRelease(env)))
    && (identity.provider !== "hostinger" || Boolean(env.CCPUN_RELEASE_ID?.trim()
      && /^[a-zA-Z0-9._-]{1,128}$/.test(env.CCPUN_RELEASE_ID.trim())))
    && Object.entries({
      NEXT_PUBLIC_CCPUN_DEPLOYMENT_PROVIDER: identity.provider,
      NEXT_PUBLIC_CCPUN_DEPLOYMENT_ROLE: identity.role,
      NEXT_PUBLIC_CCPUN_APP_ENV: identity.environment,
      NEXT_PUBLIC_CCPUN_GIT_SHA: identity.gitSha,
      NEXT_PUBLIC_CCPUN_GIT_REF: identity.gitRef,
      NEXT_PUBLIC_CCPUN_RELEASE_ID: identity.releaseId,
    }).every(([key, value]) => env[key] === undefined || env[key]?.trim() === value);
  const base = {
    provider: identity.provider,
    environment: identity.environment,
    releaseId: identity.releaseId,
    runtimeIdentityValid,
    canonicalHost,
    requestHost: host,
    canonicalHostMatched: host === canonicalHost,
    vercelEnvironment: null,
    gitBranch: identity.gitRef,
    gitSha,
    region: null,
    projectProductionUrl: null,
    source: identity.provider === "hostinger"
      ? "Hostinger release identity + GitHub Actions checks; deployment history unverified"
      : "Runtime deployment identity",
  };

  const empty = { latestProduction: null, exactShaProduction: null, history: [], githubChecks: [] };
  if (!runtimeIdentityValid || identity.provider !== "hostinger") {
    return { ...base, ...empty, status: "unavailable", error: identity.reason ?? "runtime-release-identity-unverified" };
  }

  if (identity.provider === "hostinger") {
    // CI evidence is separate from provider deployment acceptance and monitoring.
    // Never read Vercel deployment records or infer a Hostinger history from them.
    try {
      const raw = z.object({ check_runs: z.array(githubCheckSchema) }).parse(
        await githubJson(`${GITHUB_API}/commits/${gitSha}/check-runs?per_page=100`),
      );
      const githubChecks = raw.check_runs
        .filter((check) => check.head_sha === gitSha && check.app.slug === "github-actions")
        .map((check): GithubCheckItem => ({
          name: check.name,
          state: check.status !== "completed" ? check.status
            : check.conclusion === "success" ? "success"
              : ["failure", "cancelled", "timed_out", "action_required", "startup_failure"].includes(check.conclusion ?? "") ? "failure" : "unknown",
          conclusion: check.conclusion,
          completedAt: check.completed_at,
        }));
      return { ...base, ...empty, status: "partial", githubChecks, error: null };
    } catch (error) {
      const message = error instanceof Error && /^github-\d{3}$/.test(error.message) ? error.message : "github-check-reader-failed";
      return { ...base, ...empty, status: "partial", error: message };
    }
  }

  return { ...base, ...empty, status: "unavailable", error: "runtime-release-identity-unverified" };
}
