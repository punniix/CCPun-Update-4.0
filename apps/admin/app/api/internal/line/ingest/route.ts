import { createLinePrivateCrypto } from "@/lib/line/private-crypto";
import { resolveLineIngestRuntime } from "@/lib/admin/line/private-ingestion";
import { createLineWebhookPostHandler } from "@/lib/admin/line/webhook-handler";
import { lineWebhookResponseHeaders } from "@/lib/admin/line/webhook-ingress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hidden(status = 404) {
  return new Response(null, { status, headers: lineWebhookResponseHeaders() });
}

function readinessStatus() {
  try {
    if (!process.env.LINE_CHANNEL_SECRET?.trim()) return false;
    if (!resolveLineIngestRuntime()) return false;
    createLinePrivateCrypto();
    return true;
  } catch {
    return false;
  }
}

export function GET() {
  const ready = readinessStatus();
  return Response.json(
    { status: ready ? "ready" : "not-ready" },
    { status: ready ? 200 : 503, headers: lineWebhookResponseHeaders() },
  );
}

export function HEAD() {
  return hidden(readinessStatus() ? 204 : 503);
}

export function OPTIONS() {
  return new Response(null, {
    status: 405,
    headers: { ...lineWebhookResponseHeaders(), Allow: "POST, HEAD" },
  });
}

export const POST = createLineWebhookPostHandler();
