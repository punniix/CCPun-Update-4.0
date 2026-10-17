import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import { encode } from "next-auth/jwt";
import {
  consumeGoogleConnectIntent, getConnectedGoogleAccessToken, getGoogleSessionReadiness, getGoogleUatContext,
  GOOGLE_ANALYTICS_SCOPE, GOOGLE_CONNECT_AUTHORIZATION, GOOGLE_GRANT_COOKIE, issueGoogleConnectIntent,
  refreshConnectedGoogleGrant, validateGoogleSessionGrant, writeGoogleSessionGrant,
} from "../../lib/admin/seo-intelligence/google-session-connection";
import { getSeoGoogleProviderReadiness } from "../../lib/admin/seo-intelligence/provider-readiness";

const owner = { actorType: "human", actor: "owner@example.test", role: "owner" };
const sha = "6bfe13a538ee0daeaa3b5c9edaadb3d08fe70327";
const env = { AUTH_SECRET: "synthetic-auth-secret-at-least-thirty-two-characters", AUTH_GOOGLE_ID: "synthetic-client",
  AUTH_GOOGLE_SECRET: "synthetic-client-secret", AUTH_URL: "https://admin-test.ccpun.com",
  CCPUN_DEPLOYMENT_PROVIDER: "hostinger", CCPUN_DEPLOYMENT_ROLE: "admin", CCPUN_APP_ENV: "admin-uat",
  CCPUN_GIT_SHA: sha, CCPUN_GIT_REF: `codex/hostinger-release-uat-${sha}`, CCPUN_SEO_INTELLIGENCE_ENABLED: "1",
  CCPUN_GA4_PROPERTY_ID: "551040812", NEXT_PUBLIC_SANITY_PROJECT_ID: "ccb9lnw5", NEXT_PUBLIC_SANITY_DATASET: "uat" };
const session = { sub: "old-auth-random-uuid", email: owner.actor, googleConnectionAccount: "google-provider-sub" };
const callbackSession = { ...session, sub: "new-auth-random-uuid" };
const account = { provider: "google", providerAccountId: "google-provider-sub", scope: `openid email profile ${GOOGLE_ANALYTICS_SCOPE}`, refresh_token: "synthetic-refresh" };
const profile = { sub: "google-provider-sub", email: owner.actor, email_verified: true, aud: env.AUTH_GOOGLE_ID };
const context = () => { const value = getGoogleUatContext(env, owner); assert.ok(value); return value; };
function grant() {
  const ctx = context();
  const value = consumeGoogleConnectIntent({ context: ctx, session, callbackSession, account, profile,
    intent: issueGoogleConnectIntent(ctx, session) });
  assert.ok(value); return value;
}
async function requestFor(value = grant(), method = "GET") {
  const authName = "__Secure-ccpun-admin-uat.authjs.session-token";
  const authToken = await encode({ token: { ...callbackSession, googleConnectionBinding: value.sessionBinding }, secret: env.AUTH_SECRET, salt: authName, maxAge: 28_800 });
  let privateCookie = "";
  await writeGoogleSessionGrant(value, env, (_name, encoded) => { privateCookie = encoded; });
  return new Request("http://127.0.0.1:3000/api/admin/seo/providers/readiness/?provider=ga4", {
    method, headers: { host: "admin-test.ccpun.com", "x-forwarded-host": "admin-test.ccpun.com", "x-forwarded-proto": "https",
      origin: "https://admin-test.ccpun.com", cookie: `${authName}=${authToken}; ${GOOGLE_GRANT_COOKIE}=${privateCookie}` },
  });
}

test("Connect is explicit Owner/exact UAT/resource/feature only, with Analytics scope only", () => {
  assert.ok(context());
  for (const patch of [{ role: "editor" }, { actorType: "service" }, { actor: "not-an-email" }]) assert.equal(getGoogleUatContext(env, { ...owner, ...patch }), null);
  for (const patch of [{ CCPUN_APP_ENV: "production-admin" }, { CCPUN_DEPLOYMENT_PROVIDER: "local" }, { CCPUN_DEPLOYMENT_ROLE: "web" },
    { AUTH_URL: "https://admin.ccpun.com" }, { CCPUN_GA4_PROPERTY_ID: "219719845" }, { CCPUN_GA4_PROPERTY_ID: "" },
    { CCPUN_SEO_INTELLIGENCE_ENABLED: "0" }, { CCPUN_GIT_REF: "codex/another-ref" }, { NEXT_PUBLIC_SANITY_DATASET: "production" },
    { AUTH_GOOGLE_SECRET: "" }, { VERCEL_ENV: "preview" }, { AUTH_SECRET: "weak" }]) {
    assert.equal(getGoogleUatContext({ ...env, ...patch }, owner), null);
  }
  assert.equal(GOOGLE_CONNECT_AUTHORIZATION.scope, `openid email profile ${GOOGLE_ANALYTICS_SCOPE}`);
  assert.equal(GOOGLE_CONNECT_AUTHORIZATION.access_type, "offline");
  assert.equal(GOOGLE_CONNECT_AUTHORIZATION.prompt, "consent");
  assert.equal("include_granted_scopes" in GOOGLE_CONNECT_AUTHORIZATION, false);
  assert.equal(JSON.stringify(GOOGLE_CONNECT_AUTHORIZATION).includes("webmasters"), false);
});

test("signed callback intent is one-use, short-lived and exact account/client/scope bound", () => {
  const ctx = context();
  const valid = issueGoogleConnectIntent(ctx, session);
  assert.ok(consumeGoogleConnectIntent({ context: ctx, session, callbackSession, account, profile, intent: valid }));
  assert.equal(consumeGoogleConnectIntent({ context: ctx, session, callbackSession, account, profile, intent: valid }), null);
  for (const patch of [
    { account: { ...account, scope: `${GOOGLE_ANALYTICS_SCOPE}.forged` } },
    { account: { ...account, refresh_token: undefined } }, { account: { ...account, provider: "other" } },
    { account: { ...account, providerAccountId: "other" } }, { profile: { ...profile, email_verified: false } },
    { profile: { ...profile, email: "other@example.test" } }, { profile: { ...profile, sub: "other" } },
    { profile: { ...profile, aud: "other-client" } }, { profile: { ...profile, azp: "other-client" } },
    { session: { ...session, sub: "other" } }, { context: { ...ctx, source: "a".repeat(40) } },
  ]) {
    assert.equal(consumeGoogleConnectIntent({ context: ctx, session, callbackSession, account, profile,
      intent: issueGoogleConnectIntent(ctx, session), ...patch }), null);
  }
  const expired = issueGoogleConnectIntent(ctx, session, Date.now() - 300_001);
  assert.equal(consumeGoogleConnectIntent({ context: ctx, session, callbackSession, account, profile, intent: expired }), null);
  const original = issueGoogleConnectIntent(ctx, session);
  assert.equal(consumeGoogleConnectIntent({ context: ctx, session, callbackSession, account, profile, intent: `${original}x` }), null);
  const [body] = issueGoogleConnectIntent(ctx, session).split(".");
  const claims = JSON.parse(Buffer.from(body, "base64url").toString()); claims.nonce = "unknown-process-nonce-123456789";
  const unknown = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signature = createHmac("sha256", env.AUTH_SECRET).update(`ccpun-ga4-intent:${unknown}`).digest("base64url");
  assert.equal(consumeGoogleConnectIntent({ context: ctx, session, callbackSession, account, profile, intent: `${unknown}.${signature}` }), null);
});

test("grant validation rejects session/principal/property/client/source/expiry/unknown fields", () => {
  const value = grant(), ctx = context(), bound = { ...callbackSession, googleConnectionBinding: value.sessionBinding };
  assert.ok(validateGoogleSessionGrant(value, ctx, bound));
  for (const patch of [{ property: "219719845" }, { environment: "production-admin" }, { origin: "https://admin.ccpun.com" },
    { ownerHash: "a".repeat(64) }, { subjectHash: "a".repeat(64) }, { clientHash: "a".repeat(64) }, { source: "a".repeat(40) },
    { scope: "other" }, { absoluteExpiresAt: Date.now() - 1 }, { unknown: "field" }]) assert.equal(validateGoogleSessionGrant({ ...value, ...patch }, ctx, bound), null, JSON.stringify(patch));
  assert.equal(validateGoogleSessionGrant(value, ctx, session), null);
  assert.equal(validateGoogleSessionGrant(value, ctx, { ...bound, email: "other@example.test" }), null);
});

test("private cookie uses existing Auth.js encryption, bounded size and absolute 8h lifetime", async () => {
  const value = grant(); let writes = 0;
  await writeGoogleSessionGrant(value, env, (name, encoded, options) => {
    writes++; assert.equal(name, GOOGLE_GRANT_COOKIE); assert.equal(encoded.includes(value.refreshToken), false);
    assert.ok(Buffer.byteLength(`${name}=${encoded}`) < 3_800);
    assert.deepEqual({ ...options, maxAge: 0 }, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
    assert.ok(options.maxAge > 0 && options.maxAge <= 28_800);
  });
  assert.equal(writes, 1);
  await assert.rejects(writeGoogleSessionGrant({ ...value, refreshToken: "x".repeat(2_048) }, env, () => { throw Error("must not write oversized cookie"); }), /GOOGLE_SESSION_CONNECT_REQUIRED/);
  await assert.rejects(writeGoogleSessionGrant(value, env, () => { throw Error("must not write expired cookie"); }, value.absoluteExpiresAt), /GOOGLE_SESSION_CONNECT_REQUIRED/);
});

test("actual encrypted-cookie readiness is local-only and independent of missing GSC", async () => {
  const request = await requestFor();
  const ready = await getGoogleSessionReadiness(request, owner, env);
  assert.deepEqual(ready, { allowed: true, connected: true, reason: "connected" });
  const ga4 = getSeoGoogleProviderReadiness("ga4", env, ready);
  assert.equal(ga4.status, "manual-sync-ready");
  assert.equal(getSeoGoogleProviderReadiness("gsc", env).status, "configuration-required");
  assert.equal(JSON.stringify(ga4).includes("synthetic-refresh"), false);
  assert.deepEqual(await getGoogleSessionReadiness(new Request(request.url, { headers: { host: "admin-test.ccpun.com", authorization: "Bearer forged" } }), owner, env),
    { allowed: true, connected: false, reason: "connect-required" });
});

test("manual request denies wrong origin/actor/property/missing cookie/method before egress", async () => {
  let calls = 0, writes = 0;
  const fetcher: typeof fetch = async () => { calls++; return Response.json({ access_token: "synthetic-access" }); };
  const request = await requestFor(grant(), "POST");
  for (const [req, actor, vars] of [
    [new Request(request, { headers: { ...Object.fromEntries(request.headers), origin: "https://other.example.test" } }), owner, env],
    [request, { ...owner, role: "editor" }, env], [request, owner, { ...env, CCPUN_GA4_PROPERTY_ID: "219719845" }],
    [new Request(request.url, { method: "POST", headers: { host: "admin-test.ccpun.com", origin: env.AUTH_URL } }), owner, env],
    [await requestFor(), owner, env],
  ] as const) await assert.rejects(getConnectedGoogleAccessToken(req, actor, vars, () => { writes++; }, fetcher), /GOOGLE_SESSION_CONNECT_REQUIRED/);
  assert.equal(calls, 0); assert.equal(writes, 0);
});

test("rotation/concurrent manual refresh uses one process-local flight and never clears on old failure", async () => {
  const value = grant(), ctx = context(); let calls = 0;
  const fetcher: typeof fetch = async () => { calls++; await new Promise(resolve => setTimeout(resolve, 5)); return Response.json({ access_token: "synthetic-access", refresh_token: "synthetic-rotated" }); };
  const [a, b] = await Promise.all([refreshConnectedGoogleGrant(value, ctx, fetcher), refreshConnectedGoogleGrant(value, ctx, fetcher)]);
  assert.equal(calls, 1); assert.deepEqual(a, b);
  assert.equal(a.rotatedGrant?.absoluteExpiresAt, value.absoluteExpiresAt); assert.equal(a.rotatedGrant?.refreshToken, "synthetic-rotated");
  assert.equal(value.refreshToken, "synthetic-refresh");
  let writes = 0;
  await assert.rejects(getConnectedGoogleAccessToken(await requestFor(grant(), "POST"), owner, env, () => { writes++; }, async () => Response.json({ error: "private provider failure" }, { status: 400 })), /GOOGLE_SESSION_CONNECT_REQUIRED/);
  assert.equal(writes, 0);
  await assert.rejects(refreshConnectedGoogleGrant({ ...value, clientHash: "a".repeat(64) }, ctx, fetcher), /GOOGLE_SESSION_CONNECT_REQUIRED/);
  assert.equal(calls, 1);
});
