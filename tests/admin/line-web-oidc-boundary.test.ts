import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  CCPUN_VERCEL_TEAM_ID,
  CCPUN_VERCEL_TEAM_SLUG,
  CCPUN_WEB_PRODUCTION_OIDC_SUBJECT,
  CCPUN_WEB_PROJECT_ID,
  CCPUN_WEB_PROJECT_NAME,
  isProductionWebOidcClaims,
} from "../../lib/admin/line/web-service-identity";

const valid = {
  iss: `https://oidc.vercel.com/${CCPUN_VERCEL_TEAM_SLUG}`,
  aud: `https://vercel.com/${CCPUN_VERCEL_TEAM_SLUG}`,
  sub: CCPUN_WEB_PRODUCTION_OIDC_SUBJECT,
  owner: CCPUN_VERCEL_TEAM_SLUG,
  owner_id: CCPUN_VERCEL_TEAM_ID,
  project: CCPUN_WEB_PROJECT_NAME,
  project_id: CCPUN_WEB_PROJECT_ID,
  environment: "production",
};

test("Web service OIDC claims require the exact CCPun Web Production identity", () => {
  assert.equal(isProductionWebOidcClaims(valid), true);
  for (const [key, value] of [
    ["aud", "https://vercel.com/wrong-team"],
    ["project_id", "prj_wrong"],
    ["project", "ccpun-admin"],
    ["owner_id", "team_wrong"],
    ["owner", "wrong-team"],
    ["environment", "preview"],
    ["sub", "owner:wrong"],
  ] as const) {
    assert.equal(isProductionWebOidcClaims({ ...valid, [key]: value }), false, key);
  }
});

test("Admin LINE service routes authenticate before parsing or persisting payloads", () => {
  for (const file of [
    "apps/admin/app/api/internal/line/ingest-event/route.ts",

  ]) {
    const source = readFileSync(file, "utf8");
    const authAt = source.indexOf("isProductionWebServiceRequestAuthorized(request)");
    const bodyAt = source.indexOf("readEncryptedLineEventBody(request)");
    assert.ok(authAt >= 0, file);
    assert.ok(bodyAt > authAt, file);
  }
  const verifier = readFileSync("lib/admin/line/web-service-auth.ts", "utf8");
  assert.match(verifier, /isProductionVercelServiceTokenAuthorized\([\s\S]*"web"\)/);
  const shared = readFileSync("lib/runtime/vercel-service-auth.ts", "utf8");
  assert.match(shared, /createRemoteJWKSet/);
  assert.match(shared, /algorithms: \["RS256"\]/);
  assert.match(shared, /CCPUN_WEB_PRODUCTION_OIDC_SUBJECT/);
  assert.match(shared, /isProductionVercelServiceClaims/);
});

import { encryptedLineEventSchema, readEncryptedLineEventBody } from "../../lib/admin/line/encrypted-ingest";
import { createLinePrivateCrypto } from "../../lib/line/private-crypto";
import { normalizeLinePrivateEvent } from "../../lib/line/private-domain";

function encryptedMessage() {
  const crypto = createLinePrivateCrypto({
    CCPUN_LINE_IDENTITY_HMAC_KEY_V1: Buffer.alloc(32, 7).toString("base64"),
    CCPUN_LINE_ENCRYPTION_KEY_V1: Buffer.alloc(32, 11).toString("base64"),
  });
  const result = normalizeLinePrivateEvent({
    webhookEventId: "synthetic-gateway-message", type: "message", timestamp: 1790467200000,
    source: { type: "user", userId: "U_SYNTHETIC" },
    message: { id: "synthetic-message", type: "text", text: "PRIVATE_MUST_NOT_LEAK" },
  }, crypto);
  assert.equal(result.kind, "accepted");
  if (result.kind !== "accepted") throw new Error("synthetic event unavailable");
  return result.event;
}

test("encrypted gateway accepts current normalized events and rejects plaintext or damaged crypto", () => {
  const event = encryptedMessage();
  assert.equal(encryptedLineEventSchema.safeParse(event).success, true);
  assert.equal(encryptedLineEventSchema.safeParse({ ...event, rawText: "private" }).success, false);
  assert.equal(encryptedLineEventSchema.safeParse({ ...event, identity: null }).success, false);
  assert.equal(encryptedLineEventSchema.safeParse({ ...event, eventType: "follow" }).success, false);
  for (const [field, value] of [["nonceB64", Buffer.alloc(11).toString("base64")], ["authTagB64", Buffer.alloc(15).toString("base64")], ["ciphertextB64", "YQ"]]) {
    assert.equal(encryptedLineEventSchema.safeParse({ ...event, identity: {
      ...event.identity, encryptedExternalRef: { ...event.identity!.encryptedExternalRef, [field]: value },
    } }).success, false);
  }
  assert.doesNotMatch(JSON.stringify(event), /PRIVATE_MUST_NOT_LEAK|U_SYNTHETIC/);
});

test("encrypted gateway permits only locked postback context and its needsHuman contract", () => {
  const message = encryptedMessage();
  const event = { ...message, eventType: "postback", message: null,
    postback: { journey: "motor_quote_review", stage: "entry", needsHuman: false },
  };
  assert.equal(encryptedLineEventSchema.safeParse(event).success, true);
  assert.equal(encryptedLineEventSchema.safeParse({ ...event, postback: { ...event.postback, stage: "invented" } }).success, false);
  assert.equal(encryptedLineEventSchema.safeParse({ ...event, postback: { ...event.postback, needsHuman: true } }).success, false);
});

test("encrypted gateway bounds streamed bytes, including absent Content-Length", async () => {
  const event = JSON.stringify(encryptedMessage());
  assert.equal(await readEncryptedLineEventBody(new Request("https://example.invalid", { method: "POST", body: event })), event);
  assert.equal(await readEncryptedLineEventBody(new Request("https://example.invalid", { method: "POST", body: "x".repeat(256_001) })), null);
});

test("gateway preserves the existing Web transport and authenticates before production lane/body checks", () => {
  const source = readFileSync("apps/admin/app/api/internal/line/ingest-event/route.ts", "utf8");
  assert.match(source, /resolveLineIngestRuntime\(\)\?\.lane !== "production"/);
  assert.ok(source.indexOf("isProductionWebServiceRequestAuthorized(request)") < source.indexOf("resolveLineIngestRuntime()?.lane"));
  assert.match(readFileSync("apps/web/lib/line/private-ingestion.ts", "utf8"), /resolveDeploymentIdentity/);
  assert.match(readFileSync("apps/web/lib/line/private-ingestion.ts", "utf8"), /@neondatabase\/serverless/);
  const health = readFileSync("lib/admin/line/private-ingestion.ts", "utf8");
  assert.match(health, /has_function_privilege/);
  assert.match(health, /createLinePrivateCrypto\(\)/);
});

test("unknown legacy postback remains durable with a null context", () => {
  const crypto = createLinePrivateCrypto({
    CCPUN_LINE_IDENTITY_HMAC_KEY_V1: Buffer.alloc(32, 7).toString("base64"),
    CCPUN_LINE_ENCRYPTION_KEY_V1: Buffer.alloc(32, 11).toString("base64"),
  });
  const result = normalizeLinePrivateEvent({
    webhookEventId: "synthetic-legacy-postback", type: "postback", timestamp: 1790467200000,
    source: { type: "user", userId: "U_SYNTHETIC" }, postback: { data: "legacy-unrecognized-data" },
  }, crypto);
  assert.equal(result.kind, "accepted");
  if (result.kind !== "accepted") throw new Error("normalizer contract mismatch");
  assert.equal(result.event.postback, null);
  assert.equal(encryptedLineEventSchema.safeParse(result.event).success, true);
});
