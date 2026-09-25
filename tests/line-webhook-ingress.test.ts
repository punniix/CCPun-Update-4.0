import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { GET, POST } from "../apps/web/app/api/line/webhook/route";
import { createLineWebhookPostHandler } from "../apps/web/lib/line/webhook-handler";
import { createLinePrivateIngestor, probeLineAdminBridge } from "../apps/web/lib/line/private-ingestion";
import {
  LINE_WEBHOOK_X_ROBOTS_TAG,
  describeLineWebhookEvent,
  parseLineWebhookEnvelope,
  verifyLineWebhookSignature,
} from "../apps/web/lib/line/webhook-ingress";
import { createLinePrivateCrypto } from "../lib/line/private-crypto";
import { normalizeLinePrivateEvent } from "../lib/line/private-domain";
import { parseLineSafeForAIState } from "../lib/line/safe-for-ai";

function syntheticCrypto() {
  return createLinePrivateCrypto({
    CCPUN_LINE_IDENTITY_HMAC_KEY_V1: Buffer.alloc(32, 7).toString("base64"),
    CCPUN_LINE_ENCRYPTION_KEY_V1: Buffer.alloc(32, 11).toString("base64"),
  });
}

function signedRequest(body: unknown, secret: string) {
  const rawBody = JSON.stringify(body);
  const signature = createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  return new Request("https://ccpun.com/api/line/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-line-signature": signature,
    },
    body: rawBody,
  });
}

async function withChannelSecret<T>(secret: string, run: () => Promise<T>) {
  const previousSecret = process.env.LINE_CHANNEL_SECRET;
  process.env.LINE_CHANNEL_SECRET = secret;
  try {
    return await run();
  } finally {
    if (previousSecret === undefined) delete process.env.LINE_CHANNEL_SECRET;
    else process.env.LINE_CHANNEL_SECRET = previousSecret;
  }
}

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

test("LINE webhook verification request with no events stays 200 without private runtime credentials", async () => {
  await withChannelSecret("test-channel-secret", async () => {
    const response = await POST(signedRequest({ destination: "synthetic", events: [] }, "test-channel-secret"));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      ok: true,
      accepted: 0,
      duplicates: 0,
      malformed: 0,
      unsupported: 0,
    });
  });
});

test("signed private message is normalized to ciphertext/digests and response never reflects raw customer data", async () => {
  const secret = "TEST_SECRET_MUST_NOT_LEAK";
  const privateMarker = "TEST_PRIVATE_MESSAGE_MUST_NOT_LEAK";
  const userMarker = "U_TEST_PRIVATE_USER_MUST_NOT_LEAK";
  const messageId = "TEST_PROVIDER_MESSAGE_ID_MUST_NOT_LEAK";
  const captured: unknown[] = [];
  const handler = createLineWebhookPostHandler({
    createCrypto: syntheticCrypto,
    createIngestor: () => async (event) => {
      captured.push(event);
      return "accepted";
    },
  });

  await withChannelSecret(secret, async () => {
    const response = await handler(signedRequest({
      events: [{
        webhookEventId: "01SYNTHETICWEBHOOK0000000001",
        type: "message",
        timestamp: 1789662600000,
        deliveryContext: { isRedelivery: false },
        source: { type: "user", userId: userMarker },
        message: { id: messageId, type: "text", text: privateMarker },
      }],
    }, secret));
    const responseText = await response.text();

    assert.equal(response.status, 200);
    assert.match(response.headers.get("x-robots-tag") ?? "", /noindex/);
    assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
    assert.deepEqual(JSON.parse(responseText), {
      ok: true,
      accepted: 1,
      duplicates: 0,
      malformed: 0,
      unsupported: 0,
    });
    const capturedText = JSON.stringify(captured);
    assert.doesNotMatch(responseText, new RegExp(privateMarker));
    assert.doesNotMatch(responseText, new RegExp(userMarker));
    assert.doesNotMatch(responseText, new RegExp(secret));
    assert.doesNotMatch(capturedText, new RegExp(privateMarker));
    assert.doesNotMatch(capturedText, new RegExp(userMarker));
    assert.doesNotMatch(capturedText, new RegExp(messageId));
    assert.match(capturedText, /ciphertextB64/);
    assert.match(capturedText, /lookupDigest/);
  });
});

test("missing private crypto configuration fails closed without reflecting private payload", async () => {
  const secret = "test-channel-secret";
  const marker = "PRIVATE_FAIL_CLOSED_MARKER";
  const previousHmac = process.env.CCPUN_LINE_IDENTITY_HMAC_KEY_V1;
  const previousEncryption = process.env.CCPUN_LINE_ENCRYPTION_KEY_V1;
  delete process.env.CCPUN_LINE_IDENTITY_HMAC_KEY_V1;
  delete process.env.CCPUN_LINE_ENCRYPTION_KEY_V1;

  try {
    await withChannelSecret(secret, async () => {
      const handler = createLineWebhookPostHandler();
      const response = await handler(signedRequest({
        events: [{
          webhookEventId: "01SYNTHETICWEBHOOK0000000002",
          type: "message",
          timestamp: 1789662600000,
          source: { type: "user", userId: "U_SYNTHETIC" },
          message: { id: "synthetic-message-2", type: "text", text: marker },
        }],
      }, secret));
      const text = await response.text();
      assert.equal(response.status, 503);
      assert.doesNotMatch(text, new RegExp(marker));
      assert.deepEqual(JSON.parse(text), { error: "line_private_runtime_unavailable" });
    });
  } finally {
    if (previousHmac === undefined) delete process.env.CCPUN_LINE_IDENTITY_HMAC_KEY_V1;
    else process.env.CCPUN_LINE_IDENTITY_HMAC_KEY_V1 = previousHmac;
    if (previousEncryption === undefined) delete process.env.CCPUN_LINE_ENCRYPTION_KEY_V1;
    else process.env.CCPUN_LINE_ENCRYPTION_KEY_V1 = previousEncryption;
  }
});

test("malformed and unsupported events do not collapse a valid signed batch", async () => {
  const handler = createLineWebhookPostHandler({
    createCrypto: syntheticCrypto,
    createIngestor: () => async () => "accepted",
  });
  await withChannelSecret("test-channel-secret", async () => {
    const response = await handler(signedRequest({
      events: [
        {
          webhookEventId: "01SYNTHETICWEBHOOK0000000003",
          type: "message",
          timestamp: 1789662600000,
          source: { type: "user", userId: "U_SYNTHETIC" },
          message: { id: "synthetic-message-3", type: "text", text: "synthetic only" },
        },
        { type: "message", timestamp: 1789662600000 },
        { webhookEventId: "01SYNTHETICWEBHOOK0000000004", type: "beacon", timestamp: 1789662600000 },
      ],
    }, "test-channel-secret"));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      ok: true,
      accepted: 1,
      duplicates: 0,
      malformed: 1,
      unsupported: 1,
    });
  });
});

test("duplicate ingest outcomes are returned only as aggregate counts", async () => {
  const handler = createLineWebhookPostHandler({
    createCrypto: syntheticCrypto,
    createIngestor: () => async () => "duplicate_event",
  });
  await withChannelSecret("test-channel-secret", async () => {
    const response = await handler(signedRequest({
      events: [{
        webhookEventId: "01SYNTHETICWEBHOOK0000000005",
        type: "follow",
        timestamp: 1789662600000,
        source: { type: "user", userId: "U_SYNTHETIC" },
      }],
    }, "test-channel-secret"));
    assert.deepEqual(await response.json(), {
      ok: true,
      accepted: 0,
      duplicates: 1,
      malformed: 0,
      unsupported: 0,
    });
  });
});

test("normalizer supports unsend by deterministic digest without retaining target message id", () => {
  const crypto = syntheticCrypto();
  const target = "synthetic-provider-message-id";
  const result = normalizeLinePrivateEvent({
    webhookEventId: "01SYNTHETICWEBHOOK0000000006",
    type: "unsend",
    timestamp: 1789662600000,
    source: { type: "user", userId: "U_SYNTHETIC" },
    unsend: { messageId: target },
  }, crypto);
  assert.equal(result.kind, "accepted");
  if (result.kind !== "accepted") return;
  assert.equal(result.event.eventType, "unsend");
  assert.match(result.event.unsendTargetDigest ?? "", /^[0-9a-f]{64}$/);
  assert.doesNotMatch(JSON.stringify(result.event), new RegExp(target));
});

test("private crypto uses deterministic keyed lookup and authenticated randomized encryption", () => {
  const crypto = syntheticCrypto();
  const firstDigest = crypto.lookupDigest("U_SYNTHETIC", "line-user-id");
  const secondDigest = crypto.lookupDigest("U_SYNTHETIC", "line-user-id");
  const first = crypto.encrypt("synthetic private text", "message-content");
  const second = crypto.encrypt("synthetic private text", "message-content");
  assert.equal(firstDigest, secondDigest);
  assert.match(firstDigest, /^[0-9a-f]{64}$/);
  assert.notEqual(first.ciphertextB64, second.ciphertextB64);
  assert.equal(crypto.decrypt(first, "message-content"), "synthetic private text");
  assert.doesNotMatch(JSON.stringify(first), /synthetic private text/);
});

test("LINE Web bridge requires exact Production identity and a Vercel OIDC token", async () => {
  const token = "x".repeat(120);
  const variables = {
    CCPUN_APP_ENV: "production",
    VERCEL_ENV: "production",
    VERCEL_PROJECT_ID: "prj_dxwjITkd0av5QiJQv2snUlIASUWu",
    VERCEL_GIT_COMMIT_REF: "v4-production",
    VERCEL_OIDC_TOKEN: token,
  };
  let capturedAuthorization = "";
  let capturedUrl = "";
  const ingest = createLinePrivateIngestor(variables, async (input, init) => {
    capturedUrl = String(input);
    capturedAuthorization = new Headers(init?.headers).get("authorization") ?? "";
    return Response.json({ outcome: "accepted" }, { status: 200 });
  });
  const normalized = normalizeLinePrivateEvent({
    webhookEventId: "01SYNTHETICOIDC000000000001",
    type: "follow",
    timestamp: 1789662600000,
    source: { type: "user", userId: "U_SYNTHETIC" },
  }, syntheticCrypto());
  assert.equal(normalized.kind, "accepted");
  if (normalized.kind !== "accepted") return;
  assert.equal(await ingest(normalized.event), "accepted");
  assert.equal(capturedUrl, "https://admin.ccpun.com/api/internal/line/ingest-event/");
  assert.equal(capturedAuthorization, `Bearer ${token}`);

  for (const wrong of [
    { ...variables, VERCEL_PROJECT_ID: "prj_wrong" },
    { ...variables, VERCEL_GIT_COMMIT_REF: "feature/not-production" },
    { ...variables, VERCEL_ENV: "preview" },
    { ...variables, VERCEL_OIDC_TOKEN: "" },
  ]) {
    assert.throws(() => createLinePrivateIngestor(wrong), /LINE_PRIVATE_INGEST_UNAVAILABLE/);
  }
});
test("LINE bridge health uses OIDC and never needs a customer payload", async () => {
  const token = "h".repeat(120);
  const variables = {
    CCPUN_APP_ENV: "production",
    VERCEL_ENV: "production",
    VERCEL_PROJECT_ID: "prj_dxwjITkd0av5QiJQv2snUlIASUWu",
    VERCEL_GIT_COMMIT_REF: "v4-production",
    VERCEL_OIDC_TOKEN: token,
  };
  let method = "";
  let authorization = "";
  assert.equal(await probeLineAdminBridge(variables, async (_input, init) => {
    method = init?.method ?? "";
    authorization = new Headers(init?.headers).get("authorization") ?? "";
    return new Response(null, { status: 204 });
  }), true);
  assert.equal(method, "HEAD");
  assert.equal(authorization, `Bearer ${token}`);
});

test("SafeForAI accepts only allowlisted non-identifying journey state", () => {
  const safe = {
    journey: "motor_quote_review",
    stage: "waiting_for_advisor",
    material_received: true,
    needs_human: true,
    content_id: "motor-insurance-types",
  };
  assert.deepEqual(parseLineSafeForAIState(safe), safe);
  for (const forbidden of [
    "customer_id", "line_user_id", "name", "message", "document", "income", "assets", "debt", "health", "medical",
  ]) {
    assert.equal(parseLineSafeForAIState({ ...safe, [forbidden]: "forbidden" }), null, forbidden);
  }
});

test("private LINE migration contract owns DB idempotency, unsend purge and function-only ingress privileges", async () => {
  for (const file of [
    "db/migrations/20260917_private_line_runtime_v1_uat.sql",
    "db/migrations/20260917_private_line_runtime_v1_production.sql",
  ]) {
    const sql = await readFile(file, "utf8");
    const checksumSource = sql.split("-- checksum-source-begin\n")[1]?.split("-- checksum-source-end")[0];
    assert.ok(checksumSource, `${file}: checksum source`);
    const checksum = `sha256:${createHash("sha256").update(checksumSource).digest("hex")}`;
    assert.match(sql, new RegExp(checksum.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
    assert.match(sql, /event_digest text PRIMARY KEY/);
    assert.match(sql, /provider_message_digest text NOT NULL UNIQUE/);
    assert.match(sql, /CREATE TABLE IF NOT EXISTS private_line\.message_tombstone/);
    assert.match(sql, /content_ciphertext_b64 = NULL/);
    assert.match(sql, /provider_message_ciphertext_b64 = NULL/);
    assert.match(sql, /SECURITY DEFINER/);
    assert.match(sql, /GRANT EXECUTE ON FUNCTION private_line\.ingest_line_event\(jsonb\) TO ccpun_line_ingress/);
    assert.match(sql, /REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA private_line FROM ccpun_line_ingress/);
    assert.doesNotMatch(sql, /GRANT (?:SELECT|INSERT|UPDATE|DELETE).*ccpun_line_ingress/);
    assert.match(sql, /CREATE ROLE ccpun_line_ingress NOLOGIN/);
    assert.doesNotMatch(sql, /PASSWORD\s+['"]/i);
  }
});

test("signed malformed JSON is rejected without reflecting the channel secret", async () => {
  const secret = "SYNTHETIC_CHANNEL_SECRET_NEVER_REFLECT";
  const rawBody = "{not-json";
  const signature = createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  await withChannelSecret(secret, async () => {
    const response = await POST(new Request("https://ccpun.com/api/line/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-line-signature": signature,
      },
      body: rawBody,
    }));
    const text = await response.text();
    assert.equal(response.status, 400);
    assert.deepEqual(JSON.parse(text), { error: "invalid_payload" });
    assert.doesNotMatch(text, new RegExp(secret));
  });
});

test("webhook enforces the 1 MiB body limit before private ingestion", async () => {
  const secret = "test-channel-secret";
  await withChannelSecret(secret, async () => {
    const response = await POST(new Request("https://ccpun.com/api/line/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": String(1024 * 1024 + 1),
        "x-line-signature": "not-used-after-size-guard",
      },
      body: JSON.stringify({ events: [] }),
    }));
    assert.equal(response.status, 413);
    assert.deepEqual(await response.json(), { error: "payload_too_large" });
  });
});

test("route fails closed for invalid signatures and unsupported media types", async () => {
  await withChannelSecret("test-channel-secret", async () => {
    const invalidSignature = await POST(new Request("https://ccpun.com/api/line/webhook", {
      method: "POST",
      headers: { "content-type": "application/json", "x-line-signature": "invalid" },
      body: JSON.stringify({ events: [] }),
    }));
    assert.equal(invalidSignature.status, 401);

    const unsupportedMedia = await POST(new Request("https://ccpun.com/api/line/webhook", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "not-line-json",
    }));
    assert.equal(unsupportedMedia.status, 415);
  });
});

test("webhook GET is hidden and noindexed", () => {
  const response = GET();
  assert.equal(response.status, 404);
  assert.match(response.headers.get("x-robots-tag") ?? "", /noindex/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
});

test("webhook public path has no Neon runtime or private database credential", async () => {
  const routeSource = await readFile("apps/web/app/api/line/webhook/route.ts", "utf8");
  const handlerSource = await readFile("apps/web/lib/line/webhook-handler.ts", "utf8");
  const ingestSource = await readFile("apps/web/lib/line/private-ingestion.ts", "utf8");
  const eventBridgeSource = await readFile("apps/web/lib/line/public-event-bridge.ts", "utf8");
  const webPackage = await readFile("apps/web/package.json", "utf8");
  const adminIngestSource = await readFile("lib/admin/line/private-ingestion.ts", "utf8");
  const robotsSource = await readFile("apps/web/app/robots.ts", "utf8");
  const publicPath = [routeSource, handlerSource, ingestSource, eventBridgeSource].join("\n");

  assert.match(LINE_WEBHOOK_X_ROBOTS_TAG, /noindex/);
  assert.match(LINE_WEBHOOK_X_ROBOTS_TAG, /nofollow/);
  assert.match(routeSource, /export function GET\(\)/);
  assert.match(routeSource, /export (?:async )?function HEAD\(\)/);
  assert.doesNotMatch(publicPath, /console\.(log|info|warn|error|debug)/);
  assert.doesNotMatch(publicPath, /@neondatabase\/serverless|private_line\.|ccpun_line_ingress/);
  assert.doesNotMatch(publicPath, /CCPUN_ADMIN_DATABASE_URL|CCPUN_SOCIAL_DATABASE_URL|CCPUN_LINE_INGEST_DATABASE_URL/);
  assert.doesNotMatch(publicPath, /LINE_CHANNEL_ACCESS_TOKEN|CCPUN_LINE_CHANNEL_ACCESS_TOKEN/);
  assert.match(ingestSource, /VERCEL_OIDC_TOKEN/);
  assert.match(ingestSource, /admin\.ccpun\.com\/api\/internal\/line\/ingest-event/);
  assert.doesNotMatch(webPackage, /@neondatabase\/serverless/);
  assert.match(adminIngestSource, /CCPUN_ADMIN_DATABASE_URL/);
  assert.match(robotsSource, /"\/api\/"/);
});
