import {
  lineWebhookResponseHeaders,
} from "../../../../lib/line/webhook-ingress";
import { createLineWebhookPostHandler } from "../../../../lib/line/webhook-handler";
import { probeLineAdminBridge } from "../../../../lib/line/private-ingestion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hiddenRouteResponse() {
  return new Response(null, {
    status: 404,
    headers: lineWebhookResponseHeaders(),
  });
}

export function GET() {
  return hiddenRouteResponse();
}

export async function HEAD() {
  return new Response(null, {
    status: await probeLineAdminBridge() ? 204 : 503,
    headers: lineWebhookResponseHeaders(),
  });
}

export function OPTIONS() {
  return new Response(null, {
    status: 405,
    headers: {
      ...lineWebhookResponseHeaders(),
      Allow: "POST, HEAD",
    },
  });
}

export const POST = createLineWebhookPostHandler();
