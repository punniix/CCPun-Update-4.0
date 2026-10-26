import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { getContentProvider } from "../../../lib/content/provider";
import { resolveDeploymentIdentity } from "../../../lib/runtime/deployment-identity";

const LANES = {
  production: { endpoint: "ep-broad-butterfly-b3ro7u8w", suffix: "c-4.ap-southeast-1.aws.neon.tech", origin: "https://ccpun.com", project: "kyfxgjnq", dataset: "production" },
  "web-uat": { endpoint: "ep-mute-frost-aztvz394", suffix: "c-3.ap-southeast-1.aws.neon.tech", origin: "https://test.ccpun.com", project: "ccb9lnw5", dataset: "uat" },
} as const;
const ARTICLE_ID = /^(?!drafts\.)[A-Za-z0-9_.-]{1,128}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN = /^[0-9a-f]{64}$/;
const MAX_BYTES = 2048;
const HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "Cross-Origin-Resource-Policy": "same-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};
const history = { coverage: "partial", from: "2023-09-29", through: "2026-10-16" } as const;

// One dedicated credential; neither Admin nor LINE credentials are fallbacks.
export function resolveArticleRuntime(variables: Record<string, string | undefined> = process.env) {
  const deployment = resolveDeploymentIdentity(variables, "web");
  const environment = deployment.environment;
  if (!deployment.valid || deployment.provider !== "hostinger" || deployment.role !== "web"
    || (environment !== "production" && environment !== "web-uat")) return null;
  const lane = LANES[environment];
  if (variables.NEXT_PUBLIC_CCPUN_APP_ENV?.trim() !== environment
    || variables.CCPUN_UAT_MODE?.trim() !== (environment === "production" ? "0" : "1")) return null;
  if (variables.NEXT_PUBLIC_SANITY_PROJECT_ID?.trim() !== lane.project
    || variables.NEXT_PUBLIC_SANITY_DATASET?.trim() !== lane.dataset) return null;
  const connectionString = variables.CCPUN_ARTICLE_DATABASE_URL?.trim();
  if (!connectionString) return null;
  try {
    const url = new URL(connectionString);
    if (url.protocol !== "postgresql:" || url.port || url.hash
      || ![`${lane.endpoint}.${lane.suffix}`, `${lane.endpoint}-pooler.${lane.suffix}`].includes(url.hostname)
      || decodeURIComponent(url.username) !== "ccpun_article_runtime" || !url.password
      || decodeURIComponent(url.pathname.slice(1)) !== "neondb"
      || url.searchParams.get("sslmode") !== "require"
      || [...url.searchParams.keys()].some(key => !["sslmode", "channel_binding"].includes(key))
      || url.searchParams.getAll("sslmode").length !== 1
      || url.searchParams.getAll("channel_binding").length > 1
      || (url.searchParams.has("channel_binding") && url.searchParams.get("channel_binding") !== "require")) return null;
    return { connectionString, environment, origin: lane.origin };
  } catch { return null; }
}

class RequestError extends Error {
  constructor(readonly status: number, readonly code: string) { super(code); }
}

// Bounded process-level backstop, deliberately without IP, UA or global visitor IDs.
const limits = new Map<string, { start: number; count: number }>();
export function takeArticleRateLimit(key: string, maximum: number, now = Date.now()) {
  for (const [entry, bucket] of limits) if (now - bucket.start >= 60_000) limits.delete(entry);
  let bucket = limits.get(key);
  if (!bucket) {
    if (limits.size >= 256) return false;
    bucket = { start: now, count: 0 };
    limits.set(key, bucket);
  }
  if (bucket.count >= maximum) return false;
  bucket.count += 1;
  return true;
}

// Short-lived, process-local copy of the public aggregate per article. It is used
// only for GETs without a heart cookie (the aggregate is identical for everyone),
// so most card/article reads skip Neon and Sanity, and a brief upstream failure can
// return the last good totals marked `degraded` instead of a 503. No visitor data.
type Aggregate = { views: number | null; shares: number | null; hearts: number | null; activatedAt: string };
export const ARTICLE_METRICS_FRESH_MS = 30_000;
export const ARTICLE_METRICS_STALE_MS = 10 * 60_000;
const METRICS_CACHE_MAX = 256;
const metricsCache = new Map<string, { at: number; value: Aggregate }>();
export function rememberArticleMetrics(articleId: string, value: Aggregate, now = Date.now()) {
  metricsCache.delete(articleId);
  if (metricsCache.size >= METRICS_CACHE_MAX) metricsCache.delete(metricsCache.keys().next().value as string);
  metricsCache.set(articleId, { at: now, value });
}
export function cachedArticleMetrics(articleId: string, maxAge: number, now = Date.now()) {
  const entry = metricsCache.get(articleId);
  return entry && now - entry.at >= 0 && now - entry.at < maxAge ? entry.value : null;
}

// Retry once, inside the same 5 s budget, only when the request never produced a
// SQL answer (fetch failure or Neon proxy 429/5xx). SQL errors carry a SQLSTATE and
// are never retried. Writes are safe to repeat: hearts are set-not-toggle and
// view/share events are deduplicated by their eventId nonce.
type NeonFailure = { code?: unknown; sourceError?: { name?: unknown }; message?: unknown };
function transportFailure(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const failure = error as NeonFailure;
  if (typeof failure.code === "string" && /^[0-9A-Z]{5}$/.test(failure.code)) return null;
  if (failure.sourceError && typeof failure.sourceError === "object") {
    return failure.sourceError.name === "AbortError" || failure.sourceError.name === "TimeoutError" ? "timeout" : "network";
  }
  return typeof failure.message === "string" && /^Server error \(HTTP status (?:429|5\d\d)\)/.test(failure.message) ? "upstream" : null;
}
async function queryOnceMore<T>(run: () => Promise<T>, signal: AbortSignal) {
  try { return await run(); } catch (error) {
    const kind = transportFailure(error);
    if (kind !== "network" && kind !== "upstream") throw error;
    if (signal.aborted) throw error;
    await new Promise(resolve => setTimeout(resolve, 150));
    if (signal.aborted) throw error;
    return run();
  }
}

// One redacted line per 5xx/degraded answer so the next outage is visible in the
// Hostinger runtime log. Never logs messages, IDs, cookies, hashes or credentials.
type Stage = "runtime" | "content" | "database" | "result";
let logWindow = { start: 0, count: 0 };
function failureKind(stage: Stage, error: unknown) {
  if (error instanceof RequestError) return error.code;
  if (stage === "content") return error instanceof Error && error.message === "CONTENT_TIMEOUT" ? "timeout" : "error";
  if (stage === "database") {
    const code = error && typeof error === "object" ? (error as NeonFailure).code : undefined;
    if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) return `sql_${code}`;
    return transportFailure(error) ?? "error";
  }
  return stage === "result" ? "invalid_result" : "error";
}
function reportFailure(outcome: "unavailable" | "degraded", stage: Stage, method: string, error: unknown, now = Date.now()) {
  if (now - logWindow.start >= 60_000) logWindow = { start: now, count: 0 };
  if (++logWindow.count > 30) return;
  const line = `[ARTICLE_ENGAGEMENT] ${JSON.stringify({ schema: "ccpun.article_engagement.v1", outcome, stage, method, error: failureKind(stage, error) })}`;
  try { (outcome === "degraded" ? console.warn : console.error)(line); } catch { /* logging must never change the response */ }
}

function digest(value: string) { return createHash("sha256").update(value).digest("hex"); }
function cookieName(articleId: string) { return `__Secure-ccpun-heart-${digest(articleId).slice(0, 16)}`; }
function heartToken(request: Request, articleId: string) {
  const name = cookieName(articleId);
  const parts = (request.headers.get("cookie") ?? "").split(";").map(part => part.trim());
  const matching = parts.filter(part => part.startsWith(`${name}=`));
  if (matching.length !== 1) return null;
  const value = matching[0].slice(name.length + 1);
  return TOKEN.test(value) ? value : null;
}
function heartHash(articleId: string, token: string | null) {
  return token ? digest(`ccpun-article-heart-v1\0${articleId}\0${token}`) : null;
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new RequestError(415, "unsupported_media_type");
  }
  const declared = request.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > MAX_BYTES)) {
    throw new RequestError(413, "payload_too_large");
  }
  if (!request.body) throw new RequestError(400, "invalid_payload");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new RequestError(408, "request_timeout")), 3000);
  });
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), deadline]);
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) throw new RequestError(413, "payload_too_large");
      chunks.push(value);
    }
    const body: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new RequestError(400, "invalid_payload");
    return body as Record<string, unknown>;
  } catch (error) {
    void reader.cancel().catch(() => undefined);
    if (error instanceof RequestError) throw error;
    throw new RequestError(400, "invalid_payload");
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
}

async function publishedArticleId(id: string) {
  // The common runtime uses current published content. The UAT counterpart adds
  // its existing guarded fixture resolver here; Production has no fixture import.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const articles = await Promise.race([
    getContentProvider().listArticles({ includeDrafts: false }),
    new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("CONTENT_TIMEOUT")), 5000); }),
  ]).finally(() => clearTimeout(timer));
  const article = articles.find(item => item.id === id && item.status === "published"
    && !!item.publishedAt && Number.isFinite(Date.parse(item.publishedAt)) && Date.parse(item.publishedAt) <= Date.now());
  if (!article) throw new RequestError(404, "article_not_found");
  return id;
}

// The Neon driver parses timestamptz into a Date; accept that or ISO text, nothing else.
function timestampText(value: unknown) {
  const time = Object.prototype.toString.call(value) === "[object Date]" ? (value as Date).getTime()
    : typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function safeCount(value: unknown) {
  if (value === null) return null;
  if (typeof value !== "string" && typeof value !== "number") throw new Error("INVALID_METRIC");
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 0) throw new Error("INVALID_METRIC");
  return count;
}

function metricsResponse(value: Aggregate, liked: boolean, degraded: boolean) {
  return Response.json({ available: true, views: value.views, shares: value.shares, hearts: value.hearts, liked, activatedAt: value.activatedAt, history, degraded }, { headers: HEADERS });
}

export async function handleArticleEngagement(request: Request, requestedId: string) {
  let stage: Stage = "runtime";
  let cacheable = false;
  try {
    if (request.method !== "GET" && request.method !== "POST") throw new RequestError(405, "method_not_allowed");
    if (!ARTICLE_ID.test(requestedId)) throw new RequestError(404, "article_not_found");
    const runtime = resolveArticleRuntime();
    if (!runtime) throw new RequestError(503, "unavailable");
    // Hostinger may expose its internal HTTP URL. Trust only the pinned external
    // Host, and reject every supplied forwarded value unless it is single/exact.
    const requestUrl = new URL(request.url);
    const expectedHost = new URL(runtime.origin).host;
    if (!["http:", "https:"].includes(requestUrl.protocol) || requestUrl.username || requestUrl.password
      || request.headers.get("host") !== expectedHost
      || (request.headers.has("x-forwarded-host") && request.headers.get("x-forwarded-host") !== expectedHost)
      || (request.headers.has("x-forwarded-proto") && request.headers.get("x-forwarded-proto") !== "https")
      || request.headers.get("sec-fetch-site") === "cross-site") {
      throw new RequestError(403, "invalid_origin");
    }
    if (!takeArticleRateLimit("all", 1200)) throw new RequestError(429, "rate_limited");
    let body: Record<string, unknown> | null = null;
    if (request.method === "POST") {
      // Match the repository's same-origin mutation rule, using the pinned Web host.
      if (request.headers.get("origin") !== runtime.origin) throw new RequestError(403, "invalid_origin");
      if (!takeArticleRateLimit("writes", 300)) throw new RequestError(429, "rate_limited");
      body = await readBody(request);
      const allowed = body.type === "heart" ? ["type", "liked"] : ["type", "eventId", "analyticsConsent"];
      if (Object.keys(body).some(key => !allowed.includes(key))) throw new RequestError(400, "invalid_payload");
      if (body.type === "heart") {
        if (typeof body.liked !== "boolean") throw new RequestError(400, "invalid_payload");
      } else {
        if ((body.type !== "view" && body.type !== "share") || typeof body.eventId !== "string" || !UUID.test(body.eventId)) {
          throw new RequestError(400, "invalid_payload");
        }
        // Canonical consent lives in browser localStorage. This assertion must be
        // sent only after isAnalyticsEnabled(); it is not independent server proof.
        if (body.analyticsConsent !== true) throw new RequestError(403, "analytics_consent_required");
      }
    }
    // Only cookieless reads share one public answer; a heart cookie needs its own `liked`.
    cacheable = !body && heartToken(request, requestedId) === null;
    const fresh = cacheable ? cachedArticleMetrics(requestedId, ARTICLE_METRICS_FRESH_MS) : null;
    if (fresh) return metricsResponse(fresh, false, false);
    stage = "content";
    const articleId = await publishedArticleId(requestedId);
    if (body && !takeArticleRateLimit(`article:${articleId}`, 120)) throw new RequestError(429, "rate_limited");
    let token = heartToken(request, articleId);
    let setCookie = false;
    if (body?.type === "heart") {
      if (!token) { token = randomBytes(32).toString("hex"); setCookie = true; }
      if (!takeArticleRateLimit(`heart:${heartHash(articleId, token)}`, 12)) throw new RequestError(429, "rate_limited");
    }
    const hash = heartHash(articleId, token);
    stage = "database";
    const signal = AbortSignal.timeout(5000);
    const sql = neon(runtime.connectionString, { fetchOptions: { signal } });
    const rows = await queryOnceMore(() => body?.type === "heart"
      ? sql.query("SELECT * FROM ccpun_article.set_article_heart($1::text,$2::text,$3::boolean)", [articleId, hash, body.liked])
      : body
        ? sql.query("SELECT * FROM ccpun_article.record_article_event($1::text,$2::text,$3::uuid,$4::text)", [articleId, body.type, body.eventId, hash])
        : sql.query("SELECT * FROM ccpun_article.read_article_metrics($1::text,$2::text)", [articleId, hash]), signal);
    stage = "result";
    const row = rows[0];
    const activatedAt = row ? timestampText(row.activated_at) : null;
    if (!row || typeof row.liked !== "boolean" || !activatedAt) {
      throw new Error("INVALID_METRIC_RESULT");
    }
    const aggregate: Aggregate = { views: safeCount(row.views), shares: safeCount(row.shares), hearts: safeCount(row.hearts), activatedAt };
    rememberArticleMetrics(articleId, aggregate);
    const response = metricsResponse(aggregate, row.liked, false);
    if (setCookie) {
      response.headers.set("Set-Cookie", `${cookieName(articleId)}=${token}; Path=/api/article-engagement/${encodeURIComponent(requestedId)}/; Max-Age=31536000; HttpOnly; Secure; SameSite=Strict`);
    }
    return response;
  } catch (error) {
    const known = error instanceof RequestError;
    const status = known ? error.status : 503;
    if (status >= 500) {
      const stale = cacheable && !known ? cachedArticleMetrics(requestedId, ARTICLE_METRICS_STALE_MS) : null;
      reportFailure(stale ? "degraded" : "unavailable", stage, request.method === "POST" ? "POST" : "GET", error);
      if (stale) return metricsResponse(stale, false, true);
    }
    return Response.json({ available: false, error: known ? error.code : "unavailable" }, {
      status, headers: { ...HEADERS, ...(status === 429 ? { "Retry-After": "60" } : {}) },
    });
  }
}
