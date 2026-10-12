import { constantTimeBearerMatches } from "./constant-time-bearer";

export function isN8nExportRequestAuthorized(
  request: Request,
  variables: Record<string, string | undefined> = process.env,
) {
  if (variables.CCPUN_EXPORT_N8N_ENABLED?.trim() !== "true") return false;
  const expected = variables.CCPUN_EXPORT_N8N_TOKEN?.trim();
  const header = request.headers.get("authorization")?.trim();
  if (!expected || expected.length < 43 || !header?.startsWith("Bearer ")) return false;
  const supplied = header.slice(7).trim();
  return constantTimeBearerMatches(expected, supplied);
}
