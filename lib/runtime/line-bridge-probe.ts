import { resolveDeploymentIdentity, type DeploymentIdentity } from "./deployment-identity";
import { bearerToken, isProductionVercelServiceTokenAuthorized, type VercelServiceRole } from "./vercel-service-auth";

export const LINE_BRIDGE_PROBE_STATUSES = [
  "ready", "durable-not-ready", "unauthorized", "runtime-unavailable", "token-unavailable",
  "gateway-rejected", "invalid-response", "request-failed", "timeout",
] as const;
export type LineBridgeProbeStatus = (typeof LINE_BRIDGE_PROBE_STATUSES)[number];
export type LineBridgeProbeResult = { status: LineBridgeProbeStatus; webSha: string | null };
type Variables = Record<string, string | undefined>;
type Dependencies = {
  verifyToken: (token: string | null, role: VercelServiceRole) => Promise<boolean>;
  fetch: typeof fetch;
};
const defaults: Dependencies = { verifyToken: isProductionVercelServiceTokenAuthorized, fetch: (...args) => fetch(...args) };

function productionRuntime(identity: DeploymentIdentity, role: VercelServiceRole) {
  return identity.valid && identity.provider === "vercel" && identity.role === role
    && identity.environment === (role === "web" ? "production" : "production-admin")
    && identity.gitRef === "v4-production";
}
function result(status: LineBridgeProbeStatus, webSha: string | null = null): LineBridgeProbeResult { return { status, webSha }; }
function failure(error: unknown) {
  return result(error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name) ? "timeout" : "request-failed");
}

export async function probeLineBridgeFromAdmin(
  headers: Pick<Headers, "get">,
  variables: Variables = process.env,
  dependencies: Dependencies = defaults,
): Promise<LineBridgeProbeResult> {
  if (!productionRuntime(resolveDeploymentIdentity(variables, "admin"), "admin")) return result("runtime-unavailable");
  const token = headers.get("x-vercel-oidc-token");
  if (!(await dependencies.verifyToken(token, "admin"))) return result("token-unavailable");
  try {
    const response = await dependencies.fetch("https://ccpun.com/api/internal/line/bridge-probe/", {
      method: "GET", headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
      redirect: "error", signal: AbortSignal.timeout(12_000),
    });
    if (response.status === 401) return result("gateway-rejected");
    if (![200, 503].includes(response.status)) return result("invalid-response");
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object") return result("invalid-response");
    const { status, webSha } = payload as Record<string, unknown>;
    if (!LINE_BRIDGE_PROBE_STATUSES.includes(status as LineBridgeProbeStatus)
      || (response.status === 200) !== (status === "ready")) return result("invalid-response");
    return result(status as LineBridgeProbeStatus, typeof webSha === "string" && /^[a-f0-9]{40}$/i.test(webSha) ? webSha : null);
  } catch (error) { return failure(error); }
}

export async function probeLineBridgeFromWeb(
  request: Request,
  variables: Variables = process.env,
  dependencies: Dependencies = defaults,
): Promise<LineBridgeProbeResult> {
  if (!(await dependencies.verifyToken(bearerToken(request.headers.get("authorization")), "admin"))) return result("unauthorized");
  const identity = resolveDeploymentIdentity(variables, "web");
  if (!productionRuntime(identity, "web")) return result("runtime-unavailable");
  // Only this Function's injected Web token is sent back; never reuse the Admin caller token.
  const token = request.headers.get("x-vercel-oidc-token");
  if (!(await dependencies.verifyToken(token, "web"))) return result("token-unavailable");
  const webSha = identity.gitSha && /^[a-f0-9]{40}$/i.test(identity.gitSha) ? identity.gitSha : null;
  try {
    const response = await dependencies.fetch("https://admin.ccpun.com/api/internal/line/bridge-health/", {
      method: "HEAD", headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
      redirect: "error", signal: AbortSignal.timeout(8_000),
    });
    return result(response.status === 204 ? "ready" : response.status === 503 ? "durable-not-ready"
      : response.status === 401 ? "gateway-rejected" : "invalid-response", webSha);
  } catch (error) { return { ...failure(error), webSha }; }
}
