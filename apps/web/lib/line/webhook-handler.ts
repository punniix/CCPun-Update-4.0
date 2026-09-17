import { createLinePrivateCrypto, type LinePrivateCrypto } from "../../../../lib/line/private-crypto";
import { normalizeLinePrivateEvent } from "../../../../lib/line/private-domain";
import {
  LINE_WEBHOOK_MAX_BYTES,
  lineWebhookResponseHeaders,
  parseLineWebhookEnvelope,
  verifyLineWebhookSignature,
} from "./webhook-ingress";
import { createLinePrivateIngestor, type LinePrivateIngestor } from "./private-ingestion";

export type LineWebhookHandlerDependencies = {
  createCrypto?: () => LinePrivateCrypto;
  createIngestor?: () => LinePrivateIngestor;
};

function noIndexJson(payload: unknown, status: number) {
  return Response.json(payload, {
    status,
    headers: lineWebhookResponseHeaders(),
  });
}

export function createLineWebhookPostHandler(
  dependencies: LineWebhookHandlerDependencies = {},
) {
  return async function handleLineWebhookPost(request: Request) {
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

    // LINE sends an empty event list when verifying webhook connectivity. It must
    // stay independent from private runtime credentials and return 200.
    if (envelope.events.length === 0) {
      return noIndexJson({
        ok: true,
        accepted: 0,
        duplicates: 0,
        malformed: 0,
        unsupported: 0,
      }, 200);
    }

    let crypto: LinePrivateCrypto;
    let ingest: LinePrivateIngestor;
    try {
      crypto = (dependencies.createCrypto ?? (() => createLinePrivateCrypto()))();
      ingest = (dependencies.createIngestor ?? (() => createLinePrivateIngestor()))();
    } catch {
      return noIndexJson({ error: "line_private_runtime_unavailable" }, 503);
    }

    let accepted = 0;
    let duplicates = 0;
    let malformed = 0;
    let unsupported = 0;

    for (const rawEvent of envelope.events) {
      const normalized = normalizeLinePrivateEvent(rawEvent, crypto);
      if (normalized.kind === "malformed") {
        malformed += 1;
        continue;
      }
      if (normalized.kind === "unsupported") {
        unsupported += 1;
        continue;
      }

      try {
        const outcome = await ingest(normalized.event);
        if (outcome === "duplicate_event" || outcome === "duplicate_message") duplicates += 1;
        else accepted += 1;
      } catch {
        // A durable-ingestion failure returns non-2xx so LINE can redeliver. Any
        // events already committed remain safe because database uniqueness owns
        // idempotency; no private content or identifiers are reflected here.
        return noIndexJson({ error: "line_private_ingest_failed" }, 503);
      }
    }

    return noIndexJson({
      ok: true,
      accepted,
      duplicates,
      malformed,
      unsupported,
    }, 200);
  };
}
