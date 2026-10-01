import { createHash } from "node:crypto";
import { isConfiguredAdminOrigin, isSameOriginAdminMutation } from "../auth-config";
import { CCPUN_VERCEL_PROJECT_IDS, resolveDeploymentIdentity } from "../../runtime/deployment-identity";

if (typeof window !== "undefined") throw new Error("MIGRATION_SERVER_ONLY");

export const MIGRATION_ORIGIN = "https://admin.ccpun.com";
type Variables = Record<string, string | undefined>;
type Identity = { actor: string; role: string; actorType: string; authSource: string } | null;

function requireCondition(value: unknown): asserts value {
  if (!value) throw new Error("MIGRATION_DENIED");
}

function ownerDeployment(request: Request, identity: Identity, variables: Variables) {
  requireCondition(identity?.actorType === "human" && identity.authSource === "authjs"
    && identity.role === "owner" && typeof identity.actor === "string"
    && identity.actor.trim().length > 0);
  const url = new URL(request.url);
  requireCondition(url.origin === MIGRATION_ORIGIN && !url.search && !url.hash
    && isConfiguredAdminOrigin(request.url, variables.AUTH_URL));
  if (request.method === "POST") requireCondition(isSameOriginAdminMutation(request.url, request.headers.get("origin"))
    && request.headers.get("origin") === MIGRATION_ORIGIN
    && request.headers.get("sec-fetch-site") === "same-origin");
  requireCondition(request.method === "GET" || request.method === "POST");
  const deployment = resolveDeploymentIdentity(variables, "admin");
  const exporterSha = variables.VERCEL_GIT_COMMIT_SHA;
  const deploymentHost = variables.VERCEL_URL;
  requireCondition(deployment.valid && deployment.provider === "vercel" && deployment.role === "admin"
    && deployment.environment === "production-admin" && variables.VERCEL_ENV === "production"
    && deployment.projectId === CCPUN_VERCEL_PROJECT_IDS.admin
    && variables.VERCEL_GIT_COMMIT_REF === "v4-production" && deployment.gitRef === "v4-production"
    && typeof exporterSha === "string" && /^[a-f0-9]{40}$/.test(exporterSha)
    && deployment.gitSha === exporterSha && deployment.releaseId === exporterSha
    && typeof deploymentHost === "string" && /^[a-z0-9-]+\.vercel\.app$/.test(deploymentHost));
  return {
    ownerActorSha256: createHash("sha256").update(identity.actor.trim().toLowerCase()).digest("hex"),
    exporterSha, deploymentHost, sourceProjectId: CCPUN_VERCEL_PROJECT_IDS.admin, sourceRef: "v4-production",
  };
}

export function migrationOwnerMetadata(request: Request, identity: Identity, variables: Variables) {
  requireCondition(request.method === "GET");
  return ownerDeployment(request, identity, variables);
}

export function migrationOwnerPost(request: Request, identity: Identity, variables: Variables) {
  requireCondition(request.method === "POST");
  return ownerDeployment(request, identity, variables);
}
