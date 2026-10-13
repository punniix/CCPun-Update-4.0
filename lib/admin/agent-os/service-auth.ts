import { constantTimeBearerMatches } from "./constant-time-bearer";

export function isN8nAgentOsRequestAuthorized(
  request: Request,
  variables: Record<string, string | undefined> = process.env,
) {
  if (variables.CCPUN_AGENT_OS_N8N_ENABLED?.trim() !== "true") return false;
  const expected = variables.CCPUN_AGENT_OS_N8N_TOKEN?.trim();
  const authorization = request.headers.get("authorization")?.trim();
  if (!expected || expected.length < 43 || !authorization?.startsWith("Bearer ")) return false;

  const supplied = authorization.slice(7).trim();
  return constantTimeBearerMatches(expected, supplied);
}
