import { getAdminCapabilityProfile } from "./capability-profile";
import { resolveDeploymentIdentity } from "../runtime/deployment-identity";

// This is a secondary request fence, NOT receiver authentication. Host headers
// can be forged. Native activation still requires a private container/Traefik
// perimeter with no published Node port and no public Workflow route.
export function nativeWorkflowTransportDisposition(
  request: Pick<Request, "url" | "method" | "headers">,
  variables: Record<string, string | undefined> = process.env,
  profile = getAdminCapabilityProfile(),
): "unrelated" | "allow" | "deny" {
  if (variables.CCPUN_DEPLOYMENT_PROVIDER?.trim().toLowerCase() !== "hostinger") return "unrelated";
  const namespace = "/.well-known/workflow";
  const rawPath = request.url.match(/^[a-z][a-z\d+.-]*:\/\/[^/?#]+([^?#]*)/i)?.[1] ?? "";
  let candidate = rawPath;
  let workflowPath = false;
  // Decode only to recognize a forbidden variant, never to authorize one.
  for (let i = 0; i <= rawPath.length; i++) {
    const slashes = candidate.replace(/\\/g, "/").replace(/\/+/g, "/");
    const normalized = new URL(slashes || "/", "http://127.0.0.1").pathname;
    if ([slashes, normalized].some((path) => path === namespace || path.startsWith(`${namespace}/`))) {
      workflowPath = true;
      break;
    }
    // Recognize the ASCII namespace even when a later segment is malformed.
    const decoded = candidate.replace(/%([a-f\d]{2})/gi, (_match, hex: string) => String.fromCharCode(parseInt(hex, 16)));
    if (decoded === candidate) break;
    candidate = decoded;
  }
  if (!workflowPath) return "unrelated";
  if (profile !== "full") return "deny";
  const identity = resolveDeploymentIdentity(variables, "admin");
  if (!identity.valid || identity.provider !== "hostinger" || identity.role !== "admin"
    || (identity.environment !== "admin-uat"
      && !(identity.environment === "production-admin" && identity.gitRef === "v4-production"))) return "deny";
  const port = variables.PORT ?? "";
  if (!/^[1-9]\d{0,4}$/.test(port) || Number(port) > 65535) return "deny";
  const base = `http://127.0.0.1:${port}`;
  if (variables.WORKFLOW_TARGET_WORLD !== "@workflow/world-postgres"
    || variables.WORKFLOW_LOCAL_BASE_URL !== base) return "deny";
  if (request.method !== "POST"
    || ![`${namespace}/v1/flow`, `${namespace}/v1/step`].includes(rawPath)
    // NextRequest normalizes a loopback URL to localhost. The sender setting
    // and actual Host must still be the literal IPv4 loopback, never localhost.
    || ![`${base}${rawPath}`, `http://localhost:${port}${rawPath}`].includes(request.url)
    || request.headers.get("host") !== `127.0.0.1:${port}`
    || request.headers.has("origin") || request.headers.has("forwarded")
    || Array.from(request.headers.keys()).some((name) => name.startsWith("x-forwarded-"))) return "deny";
  return "allow";
}
