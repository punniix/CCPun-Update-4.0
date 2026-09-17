import {
  lineWebhookResponseHeaders,
} from "../../../../lib/line/webhook-ingress";
import { createLineWebhookPostHandler } from "../../../../lib/line/webhook-handler";

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

export function HEAD() {
  return hiddenRouteResponse();
}

export function OPTIONS() {
  return new Response(null, {
    status: 405,
    headers: {
      ...lineWebhookResponseHeaders(),
      Allow: "POST",
    },
  });
}

export const POST = createLineWebhookPostHandler();
