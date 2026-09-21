import { createLinePrivateCrypto } from "@/lib/line/private-crypto";
import { resolveLineIngestRuntime } from "@/lib/admin/line/private-ingestion";
import { createLineWebhookPostHandler } from "@/lib/admin/line/webhook-handler";
import { lineWebhookResponseHeaders } from "@/lib/admin/line/webhook-ingress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hidden(status = 404) {
  return new Response(null, { status, headers: lineWebhookResponseHeaders() });
}

export function GET() {
  return hidden();
}

export function HEAD() {
  try {
    if (!process.env.LINE_CHANNEL_SECRET?.trim()) return hidden(503);
    if (!resolveLineIngestRuntime()) return hidden(503);
    createLinePrivateCrypto();
    return hidden(204);
  } catch {
    return hidden(503);
  }
}

export function OPTIONS() {
  return new Response(null, {
    status: 405,
    headers: { ...lineWebhookResponseHeaders(), Allow: "POST, HEAD" },
  });
}

export const POST = createLineWebhookPostHandler();
