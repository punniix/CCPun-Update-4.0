import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createLocalJWKSet, exportJWK, generateKeyPair, jwtVerify, SignJWT } from "jose";
import { probeLineBridgeFromAdmin, probeLineBridgeFromWeb } from "../../lib/runtime/line-bridge-probe";
import {
  CCPUN_VERCEL_TEAM_ID, CCPUN_VERCEL_TEAM_SLUG, CCPUN_WEB_OIDC_AUDIENCE,
  isProductionVercelServiceClaims, isProductionVercelServiceTokenAuthorized,
  PRODUCTION_VERCEL_SERVICE_POLICIES, type VercelServiceRole,
} from "../../lib/runtime/vercel-service-auth";

const sha = "a".repeat(40);
const variables = (role: VercelServiceRole) => ({
  VERCEL_PROJECT_ID: PRODUCTION_VERCEL_SERVICE_POLICIES[role].projectId,
  VERCEL_ENV: "production", CCPUN_APP_ENV: role === "web" ? "production" : "production-admin",
  VERCEL_GIT_COMMIT_REF: "v4-production", VERCEL_GIT_COMMIT_SHA: sha,
});
const claims = (role: VercelServiceRole) => ({
  aud: CCPUN_WEB_OIDC_AUDIENCE, sub: PRODUCTION_VERCEL_SERVICE_POLICIES[role].subject,
  owner: CCPUN_VERCEL_TEAM_SLUG, owner_id: CCPUN_VERCEL_TEAM_ID,
  project: PRODUCTION_VERCEL_SERVICE_POLICIES[role].project,
  project_id: PRODUCTION_VERCEL_SERVICE_POLICIES[role].projectId, environment: "production",
});
const request = (authorization = "Bearer admin-token", ownToken = "web-token") => new Request("https://ccpun.com/api/internal/line/bridge-probe/", {
  headers: { authorization, "x-vercel-oidc-token": ownToken },
});
const verifyToken = async (token: string | null, role: VercelServiceRole) => token === `${role}-token`;
const adminHeaders = new Headers({ "x-vercel-oidc-token": "admin-token" });

test("Admin and Web claims are two exact, non-interchangeable Production policies", () => {
  for (const role of ["web", "admin"] as const) {
    const valid = claims(role);
    assert.equal(isProductionVercelServiceClaims(valid, role), true);
    assert.equal(isProductionVercelServiceClaims(valid, role === "web" ? "admin" : "web"), false);
    for (const key of ["aud", "sub", "owner", "owner_id", "project", "project_id", "environment"]) {
      assert.equal(isProductionVercelServiceClaims({ ...valid, [key]: "wrong" }, role), false, `${role}:${key}`);
    }
    assert.equal(isProductionVercelServiceClaims({ ...valid, aud: [valid.aud] }, role), false);
  }
});

test("signed OIDC verification rejects expiry, wrong issuer, caller role, and tampered signature", async () => {
  const pair = await generateKeyPair("RS256");
  const local = createLocalJWKSet({ keys: [{ ...await exportJWK(pair.publicKey), kid: "synthetic-test" }] });
  const verify = ((token: Parameters<typeof jwtVerify>[0], _key: unknown, options: Parameters<typeof jwtVerify>[2]) => jwtVerify(token, local, options)) as typeof jwtVerify;
  async function token(role: VercelServiceRole, issuer = `https://oidc.vercel.com/${CCPUN_VERCEL_TEAM_SLUG}`, expiration = "5m") {
    return new SignJWT(claims(role)).setProtectedHeader({ alg: "RS256", kid: "synthetic-test" })
      .setIssuer(issuer).setIssuedAt().setExpirationTime(expiration).sign(pair.privateKey);
  }
  const valid = await token("web");
  assert.equal(await isProductionVercelServiceTokenAuthorized(valid, "web", verify), true);
  assert.equal(await isProductionVercelServiceTokenAuthorized(await token("admin"), "admin", verify), true);
  assert.equal(await isProductionVercelServiceTokenAuthorized(await token("web", "https://oidc.vercel.com"), "web", verify), true);
  assert.equal(await isProductionVercelServiceTokenAuthorized(valid, "admin", verify), false);
  assert.equal(await isProductionVercelServiceTokenAuthorized(await token("web", "https://attacker.invalid"), "web", verify), false);
  assert.equal(await isProductionVercelServiceTokenAuthorized(await token("web", undefined, "-1h"), "web", verify), false);
  const parts = valid.split(".");
  parts[2] = `${parts[2]![0] === "A" ? "B" : "A"}${parts[2]!.slice(1)}`;
  assert.equal(await isProductionVercelServiceTokenAuthorized(parts.join("."), "web", verify), false);
  assert.equal(await isProductionVercelServiceTokenAuthorized(null, "web", verify), false);
  assert.equal(await isProductionVercelServiceTokenAuthorized("x".repeat(16_385), "web", verify), false);
});

test("Web authenticates Admin before own token access or network; sends only injected Web token", async (context) => {
  const delays: number[] = [];
  const original = AbortSignal.timeout.bind(AbortSignal);
  context.mock.method(AbortSignal, "timeout", (delay: number) => { delays.push(delay); return original(delay); });
  const events: string[] = [];
  const dependencies = {
    verifyToken: async (token: string | null, role: VercelServiceRole) => { events.push(`${role}:${token}`); return verifyToken(token, role); },
    fetch: (async (url, init) => {
      events.push("fetch");
      assert.equal(url, "https://admin.ccpun.com/api/internal/line/bridge-health/");
      assert.equal(init?.method, "HEAD");
      assert.equal(new Headers(init?.headers).get("authorization"), "Bearer web-token");
      assert.equal(init?.redirect, "error");
      assert.equal(init?.cache, "no-store");
      assert.ok(init?.signal instanceof AbortSignal);
      return new Response(null, { status: 204 });
    }) as typeof fetch,
  };
  assert.deepEqual(await probeLineBridgeFromWeb(request("Bearer invalid"), variables("web"), dependencies), { status: "unauthorized", webSha: null });
  assert.deepEqual(events, ["admin:invalid"]);
  events.length = 0;
  assert.deepEqual(await probeLineBridgeFromWeb(request(), variables("web"), dependencies), { status: "ready", webSha: sha });
  assert.deepEqual(events, ["admin:admin-token", "web:web-token", "fetch"]);
  assert.deepEqual(delays, [8000]);
});

test("Preview/local/Hostinger/wrong project/ref cannot initiate a diagnostic fetch", async () => {
  let fetches = 0;
  const dependencies = { verifyToken, fetch: (async () => { fetches++; return new Response(null, { status: 204 }); }) as typeof fetch };
  for (const role of ["admin", "web"] as const) {
    for (const patch of [
      { VERCEL_ENV: "preview" }, { VERCEL_PROJECT_ID: "prj_wrong" },
      { VERCEL_GIT_COMMIT_REF: "feature/preview" },
      { VERCEL_PROJECT_ID: undefined, CCPUN_DEPLOYMENT_PROVIDER: "hostinger", CCPUN_DEPLOYMENT_ROLE: role },
      { VERCEL_PROJECT_ID: undefined, CCPUN_DEPLOYMENT_PROVIDER: "local", CCPUN_DEPLOYMENT_ROLE: role },
    ]) {
      const env = { ...variables(role), ...patch };
      const result = role === "web" ? await probeLineBridgeFromWeb(request(), env, dependencies)
        : await probeLineBridgeFromAdmin(adminHeaders, env, dependencies);
      assert.equal(result.status, "runtime-unavailable");
    }
  }
  assert.equal(fetches, 0);
});

test("missing or caller-reused own token fails closed without fetching", async () => {
  let fetches = 0;
  const dependencies = { verifyToken, fetch: (async () => { fetches++; return new Response(null, { status: 204 }); }) as typeof fetch };
  assert.equal((await probeLineBridgeFromAdmin(new Headers(), variables("admin"), dependencies)).status, "token-unavailable");
  assert.equal((await probeLineBridgeFromWeb(request("Bearer admin-token", ""), variables("web"), dependencies)).status, "token-unavailable");
  assert.equal((await probeLineBridgeFromWeb(request("Bearer admin-token", "admin-token"), variables("web"), dependencies)).status, "token-unavailable");
  assert.equal(fetches, 0);
});

test("Web maps only durable readiness and sanitized failure statuses", async () => {
  for (const [httpStatus, status] of [[204, "ready"], [503, "durable-not-ready"], [401, "gateway-rejected"], [302, "invalid-response"], [500, "invalid-response"]] as const) {
    const value = await probeLineBridgeFromWeb(request(), variables("web"), { verifyToken, fetch: (async () => new Response(null, { status: httpStatus })) as typeof fetch });
    assert.deepEqual(value, { status, webSha: sha });
  }
  for (const [error, status] of [[new DOMException("private token detail", "TimeoutError"), "timeout"], [new Error("private error detail"), "request-failed"]] as const) {
    const value = await probeLineBridgeFromWeb(request(), variables("web"), { verifyToken, fetch: (async () => { throw error; }) as typeof fetch });
    assert.equal(value.status, status);
    assert.doesNotMatch(JSON.stringify(value), /private|token/);
  }
});

test("Admin sends its verified own token to fixed Web target with finite timeout and sanitizes result", async (context) => {
  const original = AbortSignal.timeout.bind(AbortSignal);
  context.mock.method(AbortSignal, "timeout", (delay: number) => { assert.equal(delay, 12000); return original(delay); });
  const dependencies = {
    verifyToken,
    fetch: (async (url, init) => {
      assert.equal(url, "https://ccpun.com/api/internal/line/bridge-probe/");
      assert.equal(new Headers(init?.headers).get("authorization"), "Bearer admin-token");
      assert.equal(init?.redirect, "error");
      assert.equal(init?.cache, "no-store");
      return Response.json({ status: "ready", webSha: sha, token: "MUST_NOT_LEAK" });
    }) as typeof fetch,
  };
  assert.deepEqual(await probeLineBridgeFromAdmin(adminHeaders, variables("admin"), dependencies), { status: "ready", webSha: sha });
  for (const payload of [{ status: "invented" }, { status: "ready", webSha: "MUST_NOT_LEAK" }]) {
    const value = await probeLineBridgeFromAdmin(adminHeaders, variables("admin"), { verifyToken, fetch: (async () => Response.json(payload)) as typeof fetch });
    assert.doesNotMatch(JSON.stringify(value), /MUST_NOT_LEAK|invented/);
  }
  assert.equal((await probeLineBridgeFromAdmin(adminHeaders, variables("admin"), { verifyToken, fetch: (async () => Response.json({ status: "ready" }, { status: 503 })) as typeof fetch })).status, "invalid-response");
});

test("owner-only queue health removes SSR Vercel probe while private Node endpoint remains isolated", () => {
  const page = readFileSync("apps/admin/app/(control-plane)/operations/health/page.tsx", "utf8");
  assert.doesNotMatch(page, /probeLineBridgeFromAdmin|line-bridge-probe/);
  const queueRead = page.indexOf("readLineDeliveryHealth(),");
  assert.ok(queueRead > page.indexOf('requireAdminPermission("settings:read")'));
  assert.match(page, /readLineSystemDeliveryDatabaseReadiness/);
  assert.match(page, /ข้อมูลและคิว LINE/);
  const route = readFileSync("apps/web/app/api/internal/line/bridge-probe/route.ts", "utf8");
  assert.match(route, /runtime = "nodejs"/);
  assert.match(route, /private, no-cache, no-store/);
  assert.match(route, /noindex, nofollow, noarchive/);
  for (const path of ["lib/runtime/line-bridge-probe.ts", "lib/runtime/vercel-service-auth.ts"]) {
    const source = readFileSync(path, "utf8");
    assert.doesNotMatch(source, /VERCEL_OIDC_TOKEN|console\.|private-ingestion|neon|sanity|process\.env\.[A-Z_]*TOKEN/);
  }
});
