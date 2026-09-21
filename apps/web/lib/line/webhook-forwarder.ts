import { z } from "zod";
import { LINE_WEBHOOK_MAX_BYTES, lineWebhookResponseHeaders } from "./webhook-ingress";

const WEB_VERCEL_PROJECT_ID = "prj_dxwjITkd0av5QiJQv2snUlIASUWu";
const PROD_ADMIN_INGEST = "https://admin.ccpun.com/api/internal/line/ingest/";

const successSchema = z.object({
  ok: z.literal(true),
  accepted: z.number().int().nonnegative(),
  duplicates: z.number().int().nonnegative(),
  malformed: z.number().int().nonnegative(),
  unsupported: z.number().int().nonnegative(),
}).strict();
const errorSchema = z.object({
  error: z.enum([
    "line_webhook_unavailable",
    "unsupported_media_type",
    "payload_too_large",
    "invalid_signature",
    "invalid_payload",
    "line_private_runtime_unavailable",
    "line_private_ingest_failed",
  ]),
}).strict();

function inferredEnvironment(variables: Record<string, string | undefined>) {
  const explicit = variables.CCPUN_APP_ENV?.trim();
  if (explicit) return explicit;
  if (variables.VERCEL_PROJECT_ID?.trim() !== WEB_VERCEL_PROJECT_ID) return "unknown";
  if (variables.VERCEL_ENV?.trim() === "production") return "production";
  if (variables.VERCEL_ENV?.trim() === "preview") return "web-uat";
  return "unknown";
}

export function resolveLineAdminIngestUrl(
  variables: Record<string, string | undefined> = process.env,
): string | null {
  const environment = inferredEnvironment(variables);
  const configured = variables.CCPUN_LINE_INGEST_ADMIN_URL?.trim();
  const raw = configured || (environment === "production" ? PROD_ADMIN_INGEST : "");
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (
      url.protocol !== "https:"
      || url.username
      || url.password
      || url.search
      || url.hash
      || url.pathname !== "/api/internal/line/ingest/"
    ) return null;
    if (environment === "production" && url.hostname !== "admin.ccpun.com") return null;
    if (
      environment === "web-uat"
      && !/^ccpun-admin(?:-.+)?\.vercel\.app$/.test(url.hostname)
    ) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function json(payload: unknown, status: number) {
  return Response.json(payload, { status, headers: lineWebhookResponseHeaders() });
}

export function createLineWebhookForwarder(
  variables: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
) {
  return async function forwardLineWebhook(request: Request) {
    const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.startsWith("application/json")) return json({ error: "unsupported_media_type" }, 415);

    const declared = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(declared) && declared > LINE_WEBHOOK_MAX_BYTES) {
      return json({ error: "payload_too_large" }, 413);
    }

    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > LINE_WEBHOOK_MAX_BYTES) {
      return json({ error: "payload_too_large" }, 413);
    }
    const signature = request.headers.get("x-line-signature");
    if (!signature || signature.length > 512) return json({ error: "invalid_signature" }, 401);

    const endpoint = resolveLineAdminIngestUrl(variables);
    if (!endpoint) return json({ error: "line_webhook_unavailable" }, 503);

    try {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
        headers: {
          "content-type": "application/json",
          "x-line-signature": signature,
        },
        body: rawBody,
      });
      const payload: unknown = await response.json();
      const success = successSchema.safeParse(payload);
      if (success.success && response.ok) return json(success.data, response.status);
      const failure = errorSchema.safeParse(payload);
      if (failure.success) return json(failure.data, response.status);
      return json({ error: "line_private_ingest_failed" }, response.ok ? 502 : response.status);
    } catch {
      return json({ error: "line_private_ingest_failed" }, 503);
    }
  };
}
