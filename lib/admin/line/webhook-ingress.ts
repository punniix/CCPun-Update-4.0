import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

export const LINE_WEBHOOK_MAX_BYTES = 1024 * 1024;
export const LINE_WEBHOOK_X_ROBOTS_TAG =
  "noindex, nofollow, noarchive, nosnippet, noimageindex";

export type LineWebhookEventDescriptor = {
  webhookEventId: string | null;
  type: string;
  messageType: string | null;
  privacyClass: "private-ingress";
};

export type LineWebhookEnvelope = {
  events: unknown[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function verifyLineWebhookSignature(
  rawBody: string,
  signature: string | null,
  channelSecret: string,
): boolean {
  if (!signature || !channelSecret) return false;

  const expected = createHmac("sha256", channelSecret).update(rawBody, "utf8").digest();
  const provided = Buffer.from(signature, "base64");

  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

export function parseLineWebhookEnvelope(rawBody: string): LineWebhookEnvelope | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return null;
  }

  const record = asRecord(parsed);
  if (!record || !Array.isArray(record.events)) return null;

  return { events: record.events };
}

export function describeLineWebhookEvent(event: unknown): LineWebhookEventDescriptor {
  const record = asRecord(event);
  const message = record ? asRecord(record.message) : null;

  return {
    webhookEventId:
      record && typeof record.webhookEventId === "string" ? record.webhookEventId : null,
    type: record && typeof record.type === "string" ? record.type : "unknown",
    messageType: message && typeof message.type === "string" ? message.type : null,
    privacyClass: "private-ingress",
  };
}

export function lineWebhookResponseHeaders(): HeadersInit {
  return {
    "Cache-Control": "no-store, max-age=0",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": LINE_WEBHOOK_X_ROBOTS_TAG,
  };
}
