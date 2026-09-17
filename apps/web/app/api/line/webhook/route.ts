import {
  LINE_WEBHOOK_MAX_BYTES,
  describeLineWebhookEvent,
  lineWebhookResponseHeaders,
  parseLineWebhookEnvelope,
  verifyLineWebhookSignature,
} from "../../../../lib/line/webhook-ingress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noIndexJson(payload: unknown, status: number) {
  return Response.json(payload, {
    status,
    headers: lineWebhookResponseHeaders(),
  });
}

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

export async function POST(request: Request) {
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  if (!channelSecret) {
    return noIndexJson({ error: "line_webhook_unavailable" }, 503);
  }

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    return noIndexJson({ error: "unsupported_media_type" }, 415);
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const declaredBytes = Number(contentLength);
    if (Number.isFinite(declaredBytes) && declaredBytes > LINE_WEBHOOK_MAX_BYTES) {
      return noIndexJson({ error: "payload_too_large" }, 413);
    }
  }

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > LINE_WEBHOOK_MAX_BYTES) {
    return noIndexJson({ error: "payload_too_large" }, 413);
  }

  const signature = request.headers.get("x-line-signature");
  if (!verifyLineWebhookSignature(rawBody, signature, channelSecret)) {
    return noIndexJson({ error: "invalid_signature" }, 401);
  }

  const envelope = parseLineWebhookEnvelope(rawBody);
  if (!envelope) {
    return noIndexJson({ error: "invalid_payload" }, 400);
  }

  // Deliberately derive only non-content descriptors at the public ingress.
  // Raw messages, source identifiers and files are never logged, executed,
  // interpolated into commands/queries, forwarded outbound or sent to AI here.
  envelope.events.map(describeLineWebhookEvent);

  return noIndexJson({ ok: true, accepted: envelope.events.length }, 200);
}
