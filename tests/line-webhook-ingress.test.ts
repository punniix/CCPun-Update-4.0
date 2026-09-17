import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  LINE_WEBHOOK_X_ROBOTS_TAG,
  describeLineWebhookEvent,
  parseLineWebhookEnvelope,
  verifyLineWebhookSignature,
} from "../apps/web/lib/line/webhook-ingress";

test("LINE webhook signature verification accepts only the matching raw body", () => {
  const secret = "test-channel-secret";
  const rawBody = JSON.stringify({ events: [] });
  const signature = createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");

  assert.equal(verifyLineWebhookSignature(rawBody, signature, secret), true);
  assert.equal(verifyLineWebhookSignature(`${rawBody} `, signature, secret), false);
  assert.equal(verifyLineWebhookSignature(rawBody, null, secret), false);
});

test("LINE webhook parser rejects malformed envelopes", () => {
  assert.equal(parseLineWebhookEnvelope("not-json"), null);
  assert.equal(parseLineWebhookEnvelope(JSON.stringify({})), null);
  assert.deepEqual(parseLineWebhookEnvelope(JSON.stringify({ events: [] })), { events: [] });
});

test("event descriptors never copy message text, source identity or postback data", () => {
  const descriptor = describeLineWebhookEvent({
    webhookEventId: "event-123",
    type: "message",
    source: { userId: "U_PRIVATE_USER" },
    message: { type: "text", text: "PRIVATE_MESSAGE" },
    postback: { data: "PRIVATE_POSTBACK_DATA" },
  });

  assert.deepEqual(descriptor, {
    webhookEventId: "event-123",
    type: "message",
    messageType: "text",
    privacyClass: "private-ingress",
  });
  assert.doesNotMatch(JSON.stringify(descriptor), /PRIVATE_MESSAGE|U_PRIVATE_USER|PRIVATE_POSTBACK_DATA/);
});

test("webhook route is hidden from crawlers and contains no raw payload logging", async () => {
  const routeSource = await readFile("apps/web/app/api/line/webhook/route.ts", "utf8");
  const robotsSource = await readFile("apps/web/app/robots.ts", "utf8");

  assert.match(LINE_WEBHOOK_X_ROBOTS_TAG, /noindex/);
  assert.match(LINE_WEBHOOK_X_ROBOTS_TAG, /nofollow/);
  assert.match(routeSource, /export function GET\(\)/);
  assert.match(routeSource, /export function HEAD\(\)/);
  assert.doesNotMatch(routeSource, /console\.(log|info|warn|error|debug)/);
  assert.match(robotsSource, /"\/api\/"/);
});
