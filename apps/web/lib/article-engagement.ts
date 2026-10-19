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

function safeCount(value: unknown) {
  if (value === null) return null;
  if (typeof value !== "string" && typeof value !== "number") throw new Error("INVALID_METRIC");
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 0) throw new Error("INVALID_METRIC");
  return count;
}

export async function handleArticleEngagement(request: Request, requestedId: string) {
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
    const articleId = await publishedArticleId(requestedId);
    if (body && !takeArticleRateLimit(`article:${articleId}`, 120)) throw new RequestError(429, "rate_limited");
    let token = heartToken(request, articleId);
    let setCookie = false;
    if (body?.type === "heart") {
      if (!token) { token = randomBytes(32).toString("hex"); setCookie = true; }
      if (!takeArticleRateLimit(`heart:${heartHash(articleId, token)}`, 12)) throw new RequestError(429, "rate_limited");
    }
    const hash = heartHash(articleId, token);
    const sql = neon(runtime.connectionString, { fetchOptions: { signal: AbortSignal.timeout(5000) } });
    const rows = body?.type === "heart"
      ? await sql.query("SELECT * FROM ccpun_article.set_article_heart($1::text,$2::text,$3::boolean)", [articleId, hash, body.liked])
      : body
        ? await sql.query("SELECT * FROM ccpun_article.record_article_event($1::text,$2::text,$3::uuid,$4::text)", [articleId, body.type, body.eventId, hash])
        : await sql.query("SELECT * FROM ccpun_article.read_article_metrics($1::text,$2::text)", [articleId, hash]);
    const row = rows[0];
    if (!row || typeof row.liked !== "boolean" || typeof row.activated_at !== "string" || !Number.isFinite(Date.parse(row.activated_at))) {
      throw new Error("INVALID_METRIC_RESULT");
    }
    const response = Response.json({ available: true, views: safeCount(row.views), shares: safeCount(row.shares), hearts: safeCount(row.hearts), liked: row.liked, activatedAt: row.activated_at, history }, { headers: HEADERS });
    if (setCookie) {
      response.headers.set("Set-Cookie", `${cookieName(articleId)}=${token}; Path=/api/article-engagement/${encodeURIComponent(requestedId)}/; Max-Age=31536000; HttpOnly; Secure; SameSite=Strict`);
    }
    return response;
  } catch (error) {
    const known = error instanceof RequestError;
    const status = known ? error.status : 503;
    return Response.json({ available: false, error: known ? error.code : "unavailable" }, {
      status, headers: { ...HEADERS, ...(status === 429 ? { "Retry-After": "60" } : {}) },
    });
  }
}
