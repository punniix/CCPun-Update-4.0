import { createHash, timingSafeEqual } from "node:crypto";

export function isN8nExportRequestAuthorized(
  request: Request,
  variables: Record<string, string | undefined> = process.env,
) {
  if (variables.CCPUN_EXPORT_N8N_ENABLED?.trim() !== "true") return false;
  const expected = variables.CCPUN_EXPORT_N8N_TOKEN?.trim();
  const header = request.headers.get("authorization")?.trim();
  if (!expected || expected.length < 43 || !header?.startsWith("Bearer ")) return false;
  const supplied = header.slice(7).trim();
  return timingSafeEqual(
    createHash("sha256").update(expected).digest(),
    createHash("sha256").update(supplied).digest(),
  );
}
