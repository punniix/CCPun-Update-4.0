// Email phase 1 (owner-approved 2026-10-25, flag default off): "send my result by email" on the
// three tools, double opt-in for the monthly digest in Neon, delivery through a signed n8n webhook.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { normalizeResultEmail, parseResultFigures, resultEmailRows, RESULT_EMAIL_FIGURES } from "../lib/email/result-summary";
import { isResultEmailEnabled } from "../lib/runtime/result-email-availability";
import { buildSemanticDataLayerEvent, resolveEventMapping, sanitizeEventParams } from "../lib/analytics";
import { handleResultEmailConfirm, handleResultEmailRequest, handleResultEmailUnsubscribe, ResultEmailLimits } from "../apps/web/lib/result-email/handler";
import { createN8nEmailProvider, createNoopEmailProvider, parseN8nWebhookUrl, signN8nPayload, verifyN8nSignature, N8N_SIGNATURE_HEADER, N8N_TIMESTAMP_HEADER, type EmailProvider, type OutboundEmail } from "../apps/web/lib/result-email/provider";
import { resolveResultEmailRuntime, type ResultEmailRuntime } from "../apps/web/lib/result-email/runtime";
import { renderResultEmail } from "../apps/web/lib/result-email/render";
import { createDoiToken, createUnsubscribeToken, hashDoiToken, verifyUnsubscribeToken } from "../apps/web/lib/result-email/tokens";
import type { DigestStore } from "../apps/web/lib/result-email/store";

const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const ORIGIN = "https://test.ccpun.com";
const SECRET = "s".repeat(40);
const ciFigures = { totalNeed: 1_250_000.4, baseNeed: 900_000, recoveryReserve: 350_000, gap: 400_000 };

function harness(overrides: Partial<ResultEmailRuntime> = {}) {
  const sent: OutboundEmail[] = [];
  const calls: string[] = [];
  const provider: EmailProvider = { id: "noop", async send(message) { sent.push(message); return { ok: true }; } };
  const store: DigestStore = {
    async requestDigest(email, hash) { calls.push(`request:${email}:${hash.length}`); return { subscriberId: "0b9f3a52-7c1d-4e8a-9f00-1234567890ab", state: "pending" }; },
    async confirmDigest(hash) { calls.push(`confirm:${hash.length}`); return { state: "confirmed" }; },
    async unsubscribe(id) { calls.push(`unsubscribe:${id}`); return { state: "unsubscribed" }; },
  };
  const runtime: ResultEmailRuntime = { environment: "web-uat", origin: ORIGIN, provider, databaseUrl: "postgresql://unused", tokenSecret: SECRET, ...overrides };
  return { sent, calls, deps: { runtime, limits: new ResultEmailLimits(), store: () => store, now: () => new Date("2026-10-25T00:00:00Z") } };
}

function post(body: unknown, { origin = ORIGIN, ip = "203.0.113.7" } = {}) {
  return new Request(`${ORIGIN}/api/result-email/`, {
    method: "POST",
    headers: { origin, "content-type": "application/json", "x-forwarded-for": ip },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
const valid = (extra: Record<string, unknown> = {}) => ({ email: "Visitor@Example.com", tool: "ci_planning", figures: ciFigures, digestConsent: false, website: "", ...extra });

test("flag: off unless exactly CCPUN_RESULT_EMAIL_ENABLED=1; off means nothing renders and every route 404s", async () => {
  for (const value of [undefined, "", "0", "true", "yes", " 1"]) assert.equal(isResultEmailEnabled({ CCPUN_RESULT_EMAIL_ENABLED: value }), false, String(value));
  assert.equal(isResultEmailEnabled({ CCPUN_RESULT_EMAIL_ENABLED: "1" }), true);
  assert.equal(resolveResultEmailRuntime({ CCPUN_APP_ENV: "production", CCPUN_DEPLOYMENT_PROVIDER: "hostinger", CCPUN_DEPLOYMENT_ROLE: "web" }), null, "Production default is off");
  let fetched = 0;
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => { fetched += 1; return new Response(null, { status: 204 }); }) as typeof fetch;
  try {
    const runtime = resolveResultEmailRuntime({ CCPUN_EMAIL_N8N_WEBHOOK_URL: "https://n8n.example.com/webhook/x", CCPUN_EMAIL_N8N_WEBHOOK_SECRET: SECRET });
    assert.equal(runtime, null, "configured webhook alone does not switch the feature on");
    for (const response of [
      await handleResultEmailRequest(post(valid()), { runtime }),
      await handleResultEmailConfirm(new Request(`${ORIGIN}/api/result-email/confirm/?token=${createDoiToken().token}`), { runtime }),
      await handleResultEmailUnsubscribe(new Request(`${ORIGIN}/api/result-email/unsubscribe/?u=x`), { runtime }),
    ]) assert.equal(response.status, 404);
    assert.equal(fetched, 0, "flag off = no webhook call");
  } finally {
    globalThis.fetch = realFetch;
  }
  const control = read("components/ui/result-email/ResultEmailControl.tsx");
  assert.match(control, /const enabled = useResultEmailEnabled\(\);[\s\S]*if \(!enabled\) return null;/);
  assert.match(read("components/ui/result-email/ResultEmailAvailability.tsx"), /createContext\(false\)/, "outside the provider the control renders nothing");
  assert.match(read("components/layout/v5/V5Page.tsx"), /<ResultEmailAvailability enabled=\{RESULT_EMAIL_ENABLED\}>/);
  for (const [file, tool] of [["features/ci-planning/components/result/CIResult.tsx", "ci_planning"], ["features/financial-health-check/components/LifeCoverageWizard.tsx", "fhc"], ["features/investment-allocation/PortfolioBuilder.tsx", "investment_allocation"]]) {
    assert.match(read(file), new RegExp(`<ResultEmailControl tool="${tool}" figures=`), `${file} offers the control`);
  }
});

test("validation: plain addresses only; strict per-tool numeric figures; labels come from the server", () => {
  assert.equal(normalizeResultEmail(" Visitor@Example.com "), "visitor@example.com");
  for (const bad of ["", "a@b", "a b@c.co", "<a@b.co>", "a@b.co\nBcc: x@y.co", "a..b@c.co", ".a@b.co", `${"a".repeat(250)}@b.co`, 42, null]) {
    assert.equal(normalizeResultEmail(bad), null, String(bad));
  }
  assert.deepEqual(parseResultFigures("ci_planning", ciFigures), { totalNeed: 1_250_000, baseNeed: 900_000, recoveryReserve: 350_000, gap: 400_000 });
  for (const bad of [{ ...ciFigures, note: 1 }, { ...ciFigures, gap: "400000" }, { ...ciFigures, gap: -1 }, { ...ciFigures, gap: Number.NaN }, { baseNeed: 1 }, [], "x", { ...ciFigures, totalNeed: 1e12 }]) {
    assert.equal(parseResultFigures("ci_planning", bad), null, JSON.stringify(bad));
  }
  assert.equal(parseResultFigures("investment_allocation", { planAmount: 1000, equityPercent: 101 }), null);
  assert.equal(parseResultFigures("investment_allocation", { planAmount: 1000, fundCount: 2.5 }), null);
  for (const [tool, specs] of Object.entries(RESULT_EMAIL_FIGURES)) assert.ok(Object.values(specs).some((spec) => "required" in spec && spec.required), `${tool} has a required headline figure`);
  const email = renderResultEmail({ tool: "fhc", figures: { gap: 3_200_000 }, origin: ORIGIN });
  assert.ok(email.html.includes("3,200,000 บาท") && email.text.includes("ช่องว่างความคุ้มครองเบื้องต้น: 3,200,000 บาท"));
  assert.doesNotMatch(email.html, /ยืนยันรับสรุปรายเดือน/, "no digest block without the separate consent");
  assert.doesNotMatch(read("apps/web/lib/result-email/render.ts") + read("lib/email/result-summary.ts"), /ฟรี|การันตี|ดีที่สุด|…/);
});

test("consent separation: the result email is transactional; the digest needs its own unticked box and a double opt-in", async () => {
  const transactional = harness();
  assert.equal((await handleResultEmailRequest(post(valid()), transactional.deps)).status, 200);
  assert.equal(transactional.calls.length, 0, "no consent ticked: nothing is stored");
  assert.equal(transactional.sent[0].kind, "result");
  assert.equal(transactional.sent[0].links.confirm, undefined);
  assert.equal(transactional.sent[0].links.unsubscribe, undefined);
  assert.equal(transactional.sent[0].to, "visitor@example.com");

  const digest = harness();
  assert.equal((await handleResultEmailRequest(post(valid({ digestConsent: true })), digest.deps)).status, 200);
  assert.deepEqual(digest.calls, ["request:visitor@example.com:64"], "only the email and a 64-hex token hash reach the store");
  assert.equal(digest.sent[0].kind, "result_with_confirmation");
  assert.match(digest.sent[0].links.confirm!, /^https:\/\/test\.ccpun\.com\/api\/result-email\/confirm\/\?token=[A-Za-z0-9_-]{43}$/);
  assert.match(digest.sent[0].links.unsubscribe!, /^https:\/\/test\.ccpun\.com\/api\/result-email\/unsubscribe\/\?u=[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/);
  assert.match(digest.sent[0].html, /ยืนยันรับสรุปรายเดือน/);

  for (const digestConsent of ["true", 1, "on", null]) assert.equal((await handleResultEmailRequest(post(valid({ digestConsent })), harness().deps)).status, 400, String(digestConsent));
  assert.equal((await handleResultEmailRequest(post(valid({ digestConsent: true })), harness({ databaseUrl: null }).deps)).status, 503, "digest without Neon fails closed, nothing sent");
  const control = read("components/ui/result-email/ResultEmailControl.tsx");
  assert.match(control, /<input type="checkbox" name="digest" disabled=\{done\} \/>/, "unticked by default, separate from sending the result");
  assert.doesNotMatch(control, /defaultChecked|checked=\{true\}/);
  assert.match(control, /href="\/privacy\/"/, "short PDPA notice links the privacy page");
  const migration = read("db/migrations/20261025_result_email_v1.sql");
  assert.doesNotMatch(migration, /GRANT (?:SELECT|INSERT|UPDATE|DELETE|ALL)[^;]*TO ccpun_email_runtime/, "runtime role never gets table privileges");
  assert.equal((migration.match(/GRANT EXECUTE ON FUNCTION/g) ?? []).length, 3);
  const table = migration.slice(migration.indexOf("CREATE TABLE IF NOT EXISTS ccpun_email.subscriber"), migration.indexOf("REVOKE ALL ON ALL TABLES"));
  assert.doesNotMatch(table, /figure|amount|gap|need|name|phone|ip_|user_agent|token text(?! UNIQUE CHECK)/i, "stores only email, consent flags, timestamps and the token hash");
});

test("abuse controls: same origin, size, honeypot, unknown keys and rate limits", async () => {
  const h = harness();
  assert.equal((await handleResultEmailRequest(post(valid(), { origin: "https://evil.example" }), h.deps)).status, 403);
  assert.equal((await handleResultEmailRequest(post(valid({ subject: "spam" })), h.deps)).status, 400, "no free text can ride along");
  assert.equal((await handleResultEmailRequest(post("x".repeat(5000)), h.deps)).status, 413);
  assert.equal((await handleResultEmailRequest(post(valid({ website: "https://spam.example" })), h.deps)).status, 200, "honeypot answers like success");
  assert.equal(h.sent.length, 0, "honeypot hit sends nothing");

  const limited = harness();
  for (let index = 0; index < 3; index += 1) assert.equal((await handleResultEmailRequest(post(valid(), { ip: `198.51.100.${index}` }), limited.deps)).status, 200);
  assert.equal((await handleResultEmailRequest(post(valid(), { ip: "198.51.100.9" }), limited.deps)).status, 429, "3 per address per day");
  const perClient = harness();
  for (let index = 0; index < 5; index += 1) assert.equal((await handleResultEmailRequest(post(valid({ email: `p${index}@example.com` })), perClient.deps)).status, 200);
  assert.equal((await handleResultEmailRequest(post(valid({ email: "p9@example.com" })), perClient.deps)).status, 429, "5 per visitor per hour");
  const limits = new ResultEmailLimits();
  let allowed = 0;
  for (let index = 0; index < 40; index += 1) if (limits.takeSend(`c${index}`, `r${index}`, 0)) allowed += 1;
  assert.equal(allowed, 30, "global per-process backstop");
});

test("double opt-in and unsubscribe links: GET never changes state; POST needs the form origin or RFC 8058 one-click", async () => {
  const h = harness();
  const { token } = createDoiToken();
  const get = await handleResultEmailConfirm(new Request(`${ORIGIN}/api/result-email/confirm/?token=${token}`), h.deps);
  assert.equal(get.status, 200);
  assert.equal(h.calls.length, 0, "a mail scanner prefetching the link confirms nothing");
  const page = await get.text();
  assert.match(page, /noindex/);
  assert.doesNotMatch(page, /googletagmanager|gtag|fbq|<script/i, "token pages load no tags or scripts");
  assert.equal(get.headers.get("referrer-policy"), "no-referrer");
  const form = (body: string, origin?: string) => new Request(`${ORIGIN}/api/result-email/confirm/`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", ...(origin ? { origin } : {}) }, body });
  assert.equal((await handleResultEmailConfirm(form(`token=${token}`), h.deps)).status, 403);
  assert.equal((await handleResultEmailConfirm(form(`token=${token}`, ORIGIN), h.deps)).status, 200);
  assert.deepEqual(h.calls, ["confirm:64"]);

  const id = "0b9f3a52-7c1d-4e8a-9f00-1234567890ab";
  const unsub = createUnsubscribeToken(id, SECRET);
  assert.equal(verifyUnsubscribeToken(unsub, SECRET), id);
  assert.equal(verifyUnsubscribeToken(unsub.slice(0, -1) + (unsub.endsWith("A") ? "B" : "A"), SECRET), null);
  assert.equal(verifyUnsubscribeToken(unsub, "t".repeat(40)), null);
  const oneClick = new Request(`${ORIGIN}/api/result-email/unsubscribe/?u=${unsub}`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "List-Unsubscribe=One-Click" });
  assert.equal((await handleResultEmailUnsubscribe(oneClick, h.deps)).status, 200);
  assert.ok(h.calls.includes(`unsubscribe:${id}`));
  assert.equal(hashDoiToken("short"), null);
});

test("n8n webhook: HMAC over timestamp + body, replay window, no secrets in the payload", async () => {
  const requests: Array<{ url: string; init: RequestInit }> = [];
  const fetchImpl = (async (url: string | URL, init?: RequestInit) => { requests.push({ url: String(url), init: init! }); return new Response(null, { status: 202 }); }) as typeof fetch;
  const env = { CCPUN_EMAIL_N8N_WEBHOOK_URL: "https://n8n.example.com/webhook/ccpun-result-email", CCPUN_EMAIL_N8N_WEBHOOK_SECRET: SECRET, CCPUN_EMAIL_TOKEN_SECRET: "u".repeat(40) };
  const provider = createN8nEmailProvider(env, { fetchImpl, now: () => 1_793_000_000_000 });
  assert.ok(provider);
  const rendered = renderResultEmail({ tool: "ci_planning", figures: { totalNeed: 1_000_000 }, origin: ORIGIN });
  assert.deepEqual(await provider!.send({ kind: "result", to: "v@example.com", tool: "ci_planning", ...rendered, summary: resultEmailRows("ci_planning", { totalNeed: 1_000_000 }), links: { tool: `${ORIGIN}/ci-planning/` } }), { ok: true });
  const [{ url, init }] = requests;
  assert.equal(url, env.CCPUN_EMAIL_N8N_WEBHOOK_URL);
  const headers = init.headers as Record<string, string>;
  const body = String(init.body);
  assert.equal(headers[N8N_TIMESTAMP_HEADER], "1793000000");
  assert.equal(headers[N8N_SIGNATURE_HEADER], signN8nPayload(SECRET, 1_793_000_000, body));
  assert.equal(verifyN8nSignature(SECRET, headers[N8N_TIMESTAMP_HEADER], headers[N8N_SIGNATURE_HEADER], body, 1_793_000_100), true);
  assert.equal(verifyN8nSignature(SECRET, headers[N8N_TIMESTAMP_HEADER], headers[N8N_SIGNATURE_HEADER], body.replace("v@example.com", "x@example.com"), 1_793_000_100), false, "tampered body");
  assert.equal(verifyN8nSignature(SECRET, headers[N8N_TIMESTAMP_HEADER], headers[N8N_SIGNATURE_HEADER], body, 1_793_000_000 + 301), false, "outside the replay window");
  assert.equal(verifyN8nSignature("x".repeat(40), headers[N8N_TIMESTAMP_HEADER], headers[N8N_SIGNATURE_HEADER], body, 1_793_000_100), false, "wrong secret");
  for (const secret of [SECRET, env.CCPUN_EMAIL_TOKEN_SECRET]) assert.ok(!body.includes(secret) && !JSON.stringify(headers).includes(secret), "no shared or token secret in the request");
  assert.deepEqual(Object.keys(JSON.parse(body)).sort(), ["html", "id", "kind", "links", "subject", "summary", "text", "to", "tool", "version"]);
  assert.doesNotMatch(body, /re_[A-Za-z0-9]|api[_-]?key|Bearer/i, "no provider credential: it lives only in n8n");
  assert.equal(init.redirect, "error");

  assert.equal(createN8nEmailProvider({ ...env, CCPUN_EMAIL_N8N_WEBHOOK_SECRET: "short" }), null);
  for (const value of ["http://n8n.example.com/x", "https://user:pw@n8n.example.com/x", "https://n8n.example.com/x?token=1", "ftp://n8n.example.com/x", "not a url"]) assert.equal(parseN8nWebhookUrl(value), null, value);
  assert.equal(parseN8nWebhookUrl("http://127.0.0.1:5678/webhook/x"), null, "loopback http only in development");
  assert.ok(parseN8nWebhookUrl("http://127.0.0.1:5678/webhook/x", true));
  assert.doesNotMatch(read("apps/web/lib/result-email/provider.ts") + read("apps/web/lib/result-email/runtime.ts"), /RESEND|api\.resend\.com|SENDGRID|BREVO/i, "the web app holds no email-provider key or endpoint");

  const logs: string[] = [];
  await createNoopEmailProvider((line) => logs.push(line)).send({ kind: "result", to: "secret.person@example.com", tool: "fhc", ...rendered, summary: [], links: { tool: ORIGIN } });
  assert.equal(logs.length, 1);
  assert.doesNotMatch(logs[0], /secret\.person|example\.com|บาท|ผล/, "the no-op adapter logs nothing personal");
});

test("analytics: one event, result_email_requested, carries only the tool id", () => {
  assert.deepEqual(sanitizeEventParams({ result_tool: "fhc", email: "a@b.co", gap: 3_200_000, figures: { gap: 1 } }), { result_tool: "fhc" });
  assert.equal(sanitizeEventParams({ result_tool: "money_story" }).result_tool, undefined);
  assert.deepEqual(resolveEventMapping("result_email_requested", sanitizeEventParams({ result_tool: "ci_planning" })), { ga: ["result_email_requested"], meta: "none" });
  const previous = process.env.NEXT_PUBLIC_SEMANTIC_EVENT_LAYER_ENABLED;
  process.env.NEXT_PUBLIC_SEMANTIC_EVENT_LAYER_ENABLED = "true";
  try {
    assert.equal(buildSemanticDataLayerEvent("result_email_requested", { result_tool: "fhc" }, { analytics: false, social: false }), null, "consent-gated");
    const row = buildSemanticDataLayerEvent("result_email_requested", sanitizeEventParams({ result_tool: "fhc", email: "a@b.co" }), { analytics: true, social: false })!;
    assert.equal(row.result_tool, "fhc");
    assert.ok(!JSON.stringify(row).includes("a@b.co"));
    assert.equal(buildSemanticDataLayerEvent("line_oa_click", {}, { analytics: true, social: false })!.result_tool, null, "cleared on later events");
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_SEMANTIC_EVENT_LAYER_ENABLED; else process.env.NEXT_PUBLIC_SEMANTIC_EVENT_LAYER_ENABLED = previous;
  }
  const control = read("components/ui/result-email/ResultEmailControl.tsx");
  assert.deepEqual([...control.matchAll(/trackEvent\(([^)]*)\)/g)].map((match) => match[1]), ['"result_email_requested", { result_tool: tool }']);
  assert.doesNotMatch(control, /\bgtag\s*\(|\bfbq\s*\(|dataLayer/);
  for (const file of ["apps/web/lib/result-email/handler.ts", "apps/web/lib/result-email/provider.ts", "apps/web/lib/result-email/store.ts"]) {
    assert.doesNotMatch(read(file), /trackEvent|console\.(?:log|error|warn)\(/, `${file}: no analytics or logging of requests`);
  }
});
