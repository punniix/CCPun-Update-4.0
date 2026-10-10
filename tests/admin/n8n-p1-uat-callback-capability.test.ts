import assert from "node:assert/strict";
import test from "node:test";
import { issueScopedUatCapability, verifyScopedUatCapability, CALLBACK_TTL_SECONDS } from "../../lib/admin/n8n/uat-callback-capability";

const context = {
  jobId: "d2f46082-7149-401a-a8a7-f20ee8180e25",
  correlationId: "bb0d3235-4949-43b8-8b24-0829b7fbeeed",
  secret: "x".repeat(96),
  nowMs: 1_797_800_000_000,
  nonce: "a".repeat(32),
};

test("scoped callback bearer is bound to job/correlation, signature and expires", () => {
  const token = issueScopedUatCapability(context);
  assert.ok(token);
  const auth = `Bearer ${token}`;
  assert.equal(verifyScopedUatCapability({ ...context, authorization: auth }), true);
  assert.equal(verifyScopedUatCapability({ ...context, authorization: "Bearer invalid" }), false);
  assert.equal(verifyScopedUatCapability({ ...context, authorization: null }), false);
  assert.equal(verifyScopedUatCapability({ ...context, authorization: auth, jobId: "3184708f-e193-4019-97b6-fabed75f081d" }), false);
  assert.equal(verifyScopedUatCapability({ ...context, authorization: auth, correlationId: "27349199-be8f-45e0-a9bc-cb303fef783e" }), false);
  assert.equal(verifyScopedUatCapability({ ...context, authorization: auth, secret: "y".repeat(96) }), false);
  assert.equal(verifyScopedUatCapability({ ...context, authorization: auth, nowMs: context.nowMs + (CALLBACK_TTL_SECONDS + 1) * 1000 }), false);
  assert.equal(verifyScopedUatCapability({ ...context, authorization: auth, nowMs: context.nowMs - 1000 }), false);
  assert.equal(verifyScopedUatCapability({ ...context, authorization: auth.replace(/.$/, "0") }), false);
});

test("invalid inputs or short secrets never issue a bearer", () => {
  assert.equal(issueScopedUatCapability({ ...context, secret: "bad" }), null);
  assert.equal(issueScopedUatCapability({ ...context, jobId: "bad" }), null);
  assert.equal(issueScopedUatCapability({ ...context, nonce: "bad" }), null);
});
