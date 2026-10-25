import "server-only";

import { createHash } from "node:crypto";
import { clientKeyFromHeaders, TokenBuckets } from "./limits";
import { isResultEmailTool, normalizeResultEmail, parseResultFigures, RESULT_EMAIL_TOOL_META, resultEmailRows } from "../../../../lib/email/result-summary";
import { DOI_TOKEN_TTL_DAYS, renderResultEmail } from "./render";
import { resolveResultEmailRuntime, type ResultEmailRuntime } from "./runtime";
import { createNeonDigestStore, type DigestStore } from "./store";
import { createDoiToken, createUnsubscribeToken, hashDoiToken, verifyUnsubscribeToken } from "./tokens";
import { confirmPage, outcomePage, unsubscribePage } from "./pages";

const MAX_BYTES = 4096;
const JSON_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Referrer-Policy": "no-referrer",
};

// Per-process token buckets (same accepted limitation as the Investment Allocation proxies).
// Recipient keys are SHA-256 digests held in memory only; they are never logged or stored.
export class ResultEmailLimits {
  readonly global = new TokenBuckets({ capacity: 30, refillPerSecond: 0.02 }, 1); // ~72 sends/hour
  readonly clients = new TokenBuckets({ capacity: 5, refillPerSecond: 5 / 3600 }); // 5/hour per visitor
  readonly recipients = new TokenBuckets({ capacity: 3, refillPerSecond: 3 / 86400 }); // 3/day per address
  readonly links = new TokenBuckets({ capacity: 20, refillPerSecond: 0.1 }); // confirm/unsubscribe pages

  takeSend(clientKey: string, recipientKey: string, now = Date.now()): boolean {
    if (!this.global.canTake("global", now) || !this.clients.canTake(clientKey, now) || !this.recipients.canTake(recipientKey, now)) return false;
    this.global.take("global", now);
    this.clients.take(clientKey, now);
    this.recipients.take(recipientKey, now);
    return true;
  }

  takeLink(clientKey: string, now = Date.now()): boolean {
    if (!this.links.canTake(clientKey, now)) return false;
    this.links.take(clientKey, now);
    return true;
  }
}

const LIMITS_KEY = Symbol.for("ccpun.resultEmail.limits.v1");
function sharedLimits(): ResultEmailLimits {
  const holder = globalThis as typeof globalThis & { [LIMITS_KEY]?: ResultEmailLimits };
  holder[LIMITS_KEY] ??= new ResultEmailLimits();
  return holder[LIMITS_KEY];
}

export type ResultEmailDependencies = {
  runtime: ResultEmailRuntime | null;
  limits: ResultEmailLimits;
  store: (databaseUrl: string) => DigestStore;
  now: () => Date;
};

function defaults(overrides: Partial<ResultEmailDependencies> = {}): ResultEmailDependencies {
  return { runtime: resolveResultEmailRuntime(), limits: sharedLimits(), store: createNeonDigestStore, now: () => new Date(), ...overrides };
}

function json(status: number, body: Record<string, unknown>) {
  return Response.json(body, { status, headers: { ...JSON_HEADERS, ...(status === 429 ? { "Retry-After": "3600" } : {}) } });
}
const notFound = () => new Response("Not Found", { status: 404, headers: JSON_HEADERS });

function sameOrigin(request: Request, origin: string): boolean {
  return request.headers.get("origin") === origin && request.headers.get("sec-fetch-site") !== "cross-site";
}

async function readLimitedText(request: Request): Promise<string | null> {
  const declared = request.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > MAX_BYTES)) return null;
  const text = await request.text();
  return Buffer.byteLength(text) > MAX_BYTES ? null : text;
}

const recipientKey = (email: string) => createHash("sha256").update(`ccpun-result-email-recipient\0${email}`).digest("hex");

/** POST /api/result-email/: validate, rate-limit, honeypot, optional digest consent, send. */
export async function handleResultEmailRequest(request: Request, overrides?: Partial<ResultEmailDependencies>): Promise<Response> {
  const deps = defaults(overrides);
  const runtime = deps.runtime;
  if (!runtime) return notFound();
  if (request.method !== "POST") return json(405, { ok: false, error: "method_not_allowed" });
  if (!sameOrigin(request, runtime.origin)) return json(403, { ok: false, error: "invalid_origin" });
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return json(415, { ok: false, error: "unsupported_media_type" });
  const raw = await readLimitedText(request).catch(() => null);
  if (raw === null) return json(413, { ok: false, error: "payload_too_large" });
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("shape");
    body = parsed as Record<string, unknown>;
  } catch {
    return json(400, { ok: false, error: "invalid_payload" });
  }
  if (Object.keys(body).some((key) => !["email", "tool", "figures", "digestConsent", "website"].includes(key))) return json(400, { ok: false, error: "invalid_payload" });
  // Honeypot: a filled hidden field gets the normal success answer and nothing is sent or stored.
  if (typeof body.website !== "string" || body.website.length > 200) return json(400, { ok: false, error: "invalid_payload" });
  if (body.website.trim()) return json(200, { ok: true });
  const email = normalizeResultEmail(body.email);
  const tool = isResultEmailTool(body.tool) ? body.tool : null;
  const figures = tool ? parseResultFigures(tool, body.figures) : null;
  if (!email || !tool || !figures || typeof body.digestConsent !== "boolean") return json(400, { ok: false, error: "invalid_payload" });
  if (!runtime.provider) return json(503, { ok: false, error: "unavailable" });
  if (body.digestConsent && (!runtime.databaseUrl || !runtime.tokenSecret)) return json(503, { ok: false, error: "unavailable" });
  if (!deps.limits.takeSend(clientKeyFromHeaders(request.headers), recipientKey(email))) return json(429, { ok: false, error: "rate_limited" });

  let confirmUrl: string | undefined;
  let unsubscribeUrl: string | undefined;
  if (body.digestConsent) {
    try {
      const doi = createDoiToken();
      const expiresAt = new Date(deps.now().getTime() + DOI_TOKEN_TTL_DAYS * 86_400_000);
      const subscription = await deps.store(runtime.databaseUrl!).requestDigest(email, doi.hash, expiresAt);
      if (subscription.state === "pending") confirmUrl = `${runtime.origin}/api/result-email/confirm/?token=${doi.token}`;
      unsubscribeUrl = `${runtime.origin}/api/result-email/unsubscribe/?u=${createUnsubscribeToken(subscription.subscriberId, runtime.tokenSecret!)}`;
    } catch {
      return json(503, { ok: false, error: "unavailable" });
    }
  }
  const rendered = renderResultEmail({ tool, figures, origin: runtime.origin, confirmUrl });
  const outcome = await runtime.provider.send({
    kind: confirmUrl ? "result_with_confirmation" : "result",
    to: email,
    tool,
    ...rendered,
    summary: resultEmailRows(tool, figures),
    // The n8n worker adds RFC 8058 one-click List-Unsubscribe headers when `unsubscribe` is present.
    links: { tool: `${runtime.origin}${RESULT_EMAIL_TOOL_META[tool].path}`, ...(confirmUrl ? { confirm: confirmUrl } : {}), ...(unsubscribeUrl ? { unsubscribe: unsubscribeUrl } : {}) },
  });
  if (!outcome.ok) return json(outcome.reason === "rate_limited" ? 429 : 503, { ok: false, error: outcome.reason === "rate_limited" ? "rate_limited" : "unavailable" });
  return json(200, { ok: true });
}

function html(status: number, page: string) {
  return new Response(page, { status, headers: { ...JSON_HEADERS, "Content-Type": "text/html; charset=utf-8" } });
}

/**
 * /api/result-email/confirm/: GET shows a button (link scanners that prefetch the URL confirm
 * nothing); POST from that same-origin form performs the double opt-in.
 */
export async function handleResultEmailConfirm(request: Request, overrides?: Partial<ResultEmailDependencies>): Promise<Response> {
  const deps = defaults(overrides);
  const runtime = deps.runtime;
  if (!runtime) return notFound();
  if (!deps.limits.takeLink(clientKeyFromHeaders(request.headers))) return html(429, outcomePage("tooMany"));
  if (request.method === "GET") {
    const token = new URL(request.url).searchParams.get("token");
    return hashDoiToken(token) ? html(200, confirmPage(token!)) : html(400, outcomePage("invalidLink"));
  }
  if (request.method !== "POST") return html(405, outcomePage("invalidLink"));
  if (!sameOrigin(request, runtime.origin)) return html(403, outcomePage("invalidLink"));
  const raw = await readLimitedText(request).catch(() => null);
  const hash = hashDoiToken(raw === null ? null : new URLSearchParams(raw).get("token"));
  if (!hash) return html(400, outcomePage("invalidLink"));
  if (!runtime.databaseUrl) return html(503, outcomePage("unavailable"));
  try {
    const { state } = await deps.store(runtime.databaseUrl).confirmDigest(hash);
    return state === "confirmed" ? html(200, outcomePage("confirmed")) : html(400, outcomePage(state === "expired" ? "expired" : "invalidLink"));
  } catch {
    return html(503, outcomePage("unavailable"));
  }
}

/**
 * /api/result-email/unsubscribe/: GET shows a button; POST unsubscribes. A mail client's RFC 8058
 * one-click POST (body "List-Unsubscribe=One-Click", token in the URL) is accepted without an
 * Origin header because the HMAC token itself proves the link came from one of our emails.
 */
export async function handleResultEmailUnsubscribe(request: Request, overrides?: Partial<ResultEmailDependencies>): Promise<Response> {
  const deps = defaults(overrides);
  const runtime = deps.runtime;
  if (!runtime) return notFound();
  if (!deps.limits.takeLink(clientKeyFromHeaders(request.headers))) return html(429, outcomePage("tooMany"));
  if (!runtime.tokenSecret) return html(503, outcomePage("unavailable"));
  const queryToken = new URL(request.url).searchParams.get("u");
  if (request.method === "GET") {
    return verifyUnsubscribeToken(queryToken, runtime.tokenSecret) ? html(200, unsubscribePage(queryToken!)) : html(400, outcomePage("invalidLink"));
  }
  if (request.method !== "POST") return html(405, outcomePage("invalidLink"));
  const raw = await readLimitedText(request).catch(() => null);
  const form = new URLSearchParams(raw ?? "");
  const oneClick = form.get("List-Unsubscribe") === "One-Click";
  if (!oneClick && !sameOrigin(request, runtime.origin)) return html(403, outcomePage("invalidLink"));
  const subscriberId = verifyUnsubscribeToken(oneClick ? queryToken : form.get("u"), runtime.tokenSecret);
  if (!subscriberId) return html(400, outcomePage("invalidLink"));
  if (!runtime.databaseUrl) return html(503, outcomePage("unavailable"));
  try {
    await deps.store(runtime.databaseUrl).unsubscribe(subscriberId);
    return html(200, outcomePage("unsubscribed"));
  } catch {
    return html(503, outcomePage("unavailable"));
  }
}
