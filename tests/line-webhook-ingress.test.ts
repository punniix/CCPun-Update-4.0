import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { GET, POST } from "../apps/web/app/api/line/webhook/route";
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

test("route accepts a valid signed LINE envelope without reflecting private content or secrets", async () => {
  const previousSecret = process.env.LINE_CHANNEL_SECRET;
  const secret = "TEST_SECRET_MUST_NOT_LEAK";
  const privateMarker = "TEST_PRIVATE_MESSAGE_MUST_NOT_LEAK";
  const rawBody = JSON.stringify({
    events: [
      {
        webhookEventId: "event-123",
        type: "message",
        source: { userId: "U_PRIVATE_USER" },
        message: { type: "text", text: privateMarker },
      },
    ],
  });
  const signature = createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  process.env.LINE_CHANNEL_SECRET = secret;

  try {
    const response = await POST(
      new Request("https://ccpun.com/api/line/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-line-signature": signature,
        },
        body: rawBody,
      }),
    );
    const responseText = await response.text();

    assert.equal(response.status, 200);
    assert.match(response.headers.get("x-robots-tag") ?? "", /noindex/);
    assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
    assert.doesNotMatch(responseText, new RegExp(privateMarker));
    assert.doesNotMatch(responseText, new RegExp(secret));
    assert.deepEqual(JSON.parse(responseText), { ok: true, accepted: 1 });
  } finally {
    if (previousSecret === undefined) delete process.env.LINE_CHANNEL_SECRET;
    else process.env.LINE_CHANNEL_SECRET = previousSecret;
  }
});

test("route fails closed for invalid signatures and unsupported media types", async () => {
  const previousSecret = process.env.LINE_CHANNEL_SECRET;
  process.env.LINE_CHANNEL_SECRET = "test-channel-secret";

  try {
    const invalidSignature = await POST(
      new Request("https://ccpun.com/api/line/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-line-signature": "invalid",
        },
        body: JSON.stringify({ events: [] }),
      }),
    );
    assert.equal(invalidSignature.status, 401);

    const unsupportedMedia = await POST(
      new Request("https://ccpun.com/api/line/webhook", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: "not-line-json",
      }),
    );
    assert.equal(unsupportedMedia.status, 415);
  } finally {
    if (previousSecret === undefined) delete process.env.LINE_CHANNEL_SECRET;
    else process.env.LINE_CHANNEL_SECRET = previousSecret;
  }
});

test("webhook GET is hidden and noindexed", () => {
  const response = GET();
  assert.equal(response.status, 404);
  assert.match(response.headers.get("x-robots-tag") ?? "", /noindex/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
});

test("webhook route is hidden from crawlers and contains no secret-exfiltration primitives", async () => {
  const routeSource = await readFile("apps/web/app/api/line/webhook/route.ts", "utf8");
  const robotsSource = await readFile("apps/web/app/robots.ts", "utf8");

  assert.match(LINE_WEBHOOK_X_ROBOTS_TAG, /noindex/);
  assert.match(LINE_WEBHOOK_X_ROBOTS_TAG, /nofollow/);
  assert.match(routeSource, /export function GET\(\)/);
  assert.match(routeSource, /export function HEAD\(\)/);
  assert.match(routeSource, /application\/json/);
  assert.doesNotMatch(routeSource, /console\.(log|info|warn|error|debug)/);
  assert.doesNotMatch(routeSource, /\beval\s*\(/);
  assert.doesNotMatch(routeSource, /new\s+Function\s*\(/);
  assert.doesNotMatch(routeSource, /child_process|execFile|spawn\s*\(/);
  assert.doesNotMatch(routeSource, /\bfetch\s*\(/);
  assert.doesNotMatch(routeSource, /LINE_CHANNEL_ACCESS_TOKEN/);
  assert.doesNotMatch(routeSource, /NEXT_PUBLIC_LINE/);
  assert.match(robotsSource, /"\/api\/"/);
});
