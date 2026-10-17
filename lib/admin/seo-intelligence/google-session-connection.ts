import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { encode, getToken } from "next-auth/jwt";
import { z } from "zod";
import { getAdminCookieNamespace, getAdminGoogleOAuthCredentials, hasStrongAuthSecret } from "../auth-config";
import { isSeoIntelligenceEnabled } from "./foundation";
import { refreshGoogleSessionAccessToken } from "./google-data-auth";
import { isPostPublishAdminOriginAllowed } from "./post-publish-origin";

if (typeof window !== "undefined") throw new Error("GOOGLE_SESSION_SERVER_ONLY");

export const GOOGLE_ANALYTICS_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
export const GOOGLE_UAT_PROPERTY = "551040812";
export const GOOGLE_INTENT_COOKIE = "__Secure-ccpun-admin-uat.ga4-intent";
export const GOOGLE_GRANT_COOKIE = "__Secure-ccpun-admin-uat.ga4-grant";
export const GOOGLE_CONNECT_AUTHORIZATION = Object.freeze({
  scope: `openid email profile ${GOOGLE_ANALYTICS_SCOPE}`,
  access_type: "offline", prompt: "consent",
});
const INTENT_MS = 5 * 60_000;
const GRANT_MS = 8 * 60 * 60_000;
const MAX_COOKIE_BYTES = 3_800;
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const nonce = () => randomBytes(24).toString("base64url");
type Variables = Record<string, string | undefined>;
type Actor = { actorType: string; actor: string; role: string };
type SessionToken = { sub?: unknown; email?: unknown; googleConnectionBinding?: unknown; googleConnectionAccount?: unknown };
export type GoogleCookieOptions = { httpOnly: true; secure: true; sameSite: "lax"; path: string; maxAge: number };
export type GoogleCookieWriter = (name: string, value: string, options: GoogleCookieOptions) => void;
export type GoogleSessionReadiness = { allowed: boolean; connected: boolean; reason: "configuration-required" | "connect-required" | "connected" };
type Context = {
  ownerHash: string; clientHash: string; clientId: string; clientSecret: string;
  secret: string; source: string;
};
const bindingShape = {
  ownerHash: z.string().regex(/^[a-f0-9]{64}$/),
  subjectHash: z.string().regex(/^[a-f0-9]{64}$/),
  accountHash: z.string().regex(/^[a-f0-9]{64}$/),
  clientHash: z.string().regex(/^[a-f0-9]{64}$/),
  source: z.string().regex(/^[a-f0-9]{40}$/),
  property: z.literal(GOOGLE_UAT_PROPERTY),
  environment: z.literal("admin-uat"), origin: z.literal("https://admin-test.ccpun.com"),
};
const intentSchema = z.object({ ...bindingShape, nonce: z.string().min(20).max(64), issuedAt: z.number().int(), expiresAt: z.number().int() }).strict();
const grantSchema = z.object({
  ...bindingShape, sessionBinding: z.string().min(20).max(64), grantId: z.string().min(20).max(64),
  refreshToken: z.string().min(1).max(2_048), scope: z.literal(GOOGLE_ANALYTICS_SCOPE),
  issuedAt: z.number().int(), absoluteExpiresAt: z.number().int(),
  iat: z.number().int().optional(), exp: z.number().int().optional(), jti: z.string().optional(),
}).strict();
export type GoogleSessionGrant = z.infer<typeof grantSchema>;

// Process-local, bounded nonce admission. A restart/another instance requires reconnect;
// absence must never fall back to signature-only admission.
const intentRegistry = globalThis as typeof globalThis & { [key: symbol]: unknown };
const registryKey = Symbol.for("ccpun.admin-uat.google-connect.intents.v1");
if (intentRegistry[registryKey] !== undefined && !(intentRegistry[registryKey] instanceof Map)) throw new Error("GOOGLE_SESSION_REGISTRY_UNAVAILABLE");
const pendingIntents = (intentRegistry[registryKey] ??= new Map<string, number>()) as Map<string, number>;
function sweepIntents(now: number) {
  for (const [key, expiry] of pendingIntents) if (expiry <= now) pendingIntents.delete(key);
}

export function getGoogleUatContext(env: Variables, actor: Actor): Context | null {
  if (actor.actorType !== "human" || actor.role !== "owner" || !actor.actor.includes("@")) return null;
  if (env.CCPUN_DEPLOYMENT_PROVIDER !== "hostinger" || env.CCPUN_DEPLOYMENT_ROLE !== "admin"
    || env.CCPUN_APP_ENV !== "admin-uat" || env.AUTH_URL !== "https://admin-test.ccpun.com"
    || env.CCPUN_GA4_PROPERTY_ID !== GOOGLE_UAT_PROPERTY || !hasStrongAuthSecret(env.AUTH_SECRET)
    || !/^[a-f0-9]{40}$/.test(env.CCPUN_GIT_SHA ?? "")
    || env.CCPUN_GIT_REF !== `codex/hostinger-release-uat-${env.CCPUN_GIT_SHA}`) return null;
  if (!isSeoIntelligenceEnabled({
    releaseVariables: env, flag: env.CCPUN_SEO_INTELLIGENCE_ENABLED, environment: "admin-uat",
    deploymentProvider: env.CCPUN_DEPLOYMENT_PROVIDER, deploymentRole: env.CCPUN_DEPLOYMENT_ROLE,
    releaseId: env.CCPUN_RELEASE_ID, gitSha: env.CCPUN_GIT_SHA, gitBranch: env.CCPUN_GIT_REF,
    vercelEnvironment: env.VERCEL_ENV, projectId: env.VERCEL_PROJECT_ID || env.NEXT_PUBLIC_CCPUN_VERCEL_PROJECT_ID,
    productionAdminProjectId: env.CCPUN_PRODUCTION_ADMIN_VERCEL_PROJECT_ID || env.NEXT_PUBLIC_CCPUN_PRODUCTION_ADMIN_VERCEL_PROJECT_ID,
    sanityProjectId: env.NEXT_PUBLIC_SANITY_PROJECT_ID, sanityDataset: env.NEXT_PUBLIC_SANITY_DATASET,
  })) return null;
  const credentials = getAdminGoogleOAuthCredentials("admin-uat", env);
  if (!credentials) return null;
  return { ownerHash: digest(actor.actor.trim().toLowerCase()), clientHash: digest(credentials.clientId),
    clientId: credentials.clientId, clientSecret: credentials.clientSecret,
    secret: env.AUTH_SECRET!, source: env.CCPUN_GIT_SHA! };
}

function sessionMatches(session: SessionToken, context: Context) {
  return typeof session.sub === "string" && session.sub.length > 0
    && typeof session.googleConnectionAccount === "string" && session.googleConnectionAccount.length > 0
    && typeof session.email === "string" && digest(session.email.trim().toLowerCase()) === context.ownerHash;
}
function claims(context: Context, session: SessionToken) {
  return { ownerHash: context.ownerHash, subjectHash: digest(session.sub as string), clientHash: context.clientHash,
    accountHash: digest(session.googleConnectionAccount as string),
    source: context.source, property: GOOGLE_UAT_PROPERTY, environment: "admin-uat" as const,
    origin: "https://admin-test.ccpun.com" as const };
}

export function issueGoogleConnectIntent(context: Context, session: SessionToken, now = Date.now()): string {
  if (!sessionMatches(session, context)) throw new Error("GOOGLE_SESSION_CONNECT_REQUIRED");
  sweepIntents(now);
  if (pendingIntents.size >= 128) throw new Error("GOOGLE_SESSION_CONNECT_REQUIRED");
  const payload = { ...claims(context, session), nonce: nonce(), issuedAt: now, expiresAt: now + INTENT_MS };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", context.secret).update(`ccpun-ga4-intent:${body}`).digest("base64url");
  pendingIntents.set(payload.nonce, payload.expiresAt);
  return `${body}.${signature}`;
}

export function consumeGoogleConnectIntent(input: {
  intent: string; context: Context; session: SessionToken; callbackSession: SessionToken;
  account: { provider?: unknown; providerAccountId?: unknown; scope?: unknown; refresh_token?: unknown };
  profile: { sub?: unknown; email?: unknown; email_verified?: unknown; aud?: unknown; azp?: unknown };
  now?: number;
}): GoogleSessionGrant | null {
  const now = input.now ?? Date.now();
  try {
    if (input.intent.length > 3_000 || !sessionMatches(input.session, input.context)
      || !sessionMatches(input.callbackSession, input.context)) return null;
    const [body, signature, extra] = input.intent.split(".");
    if (!body || !signature || extra) return null;
    const expected = createHmac("sha256", input.context.secret).update(`ccpun-ga4-intent:${body}`).digest();
    const supplied = Buffer.from(signature, "base64url");
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
    const parsed = intentSchema.safeParse(JSON.parse(Buffer.from(body, "base64url").toString("utf8")));
    if (!parsed.success) return null;
    const intent = parsed.data;
    sweepIntents(now);
    const admitted = pendingIntents.get(intent.nonce);
    pendingIntents.delete(intent.nonce);
    if (admitted !== intent.expiresAt || intent.expiresAt <= now || intent.issuedAt > now
      || intent.expiresAt - intent.issuedAt !== INTENT_MS) return null;
    const wanted = claims(input.context, input.session);
    if (Object.entries(wanted).some(([key, value]) => intent[key as keyof typeof wanted] !== value)) return null;
    const { account, profile } = input;
    const audience = Array.isArray(profile.aud) ? profile.aud : [profile.aud];
    if (account.provider !== "google" || typeof account.providerAccountId !== "string"
      || account.providerAccountId !== profile.sub || profile.sub !== input.session.googleConnectionAccount
      || profile.sub !== input.callbackSession.googleConnectionAccount
      || profile.email_verified !== true || typeof profile.email !== "string"
      || digest(profile.email.trim().toLowerCase()) !== input.context.ownerHash
      || !audience.includes(input.context.clientId) || (profile.azp !== undefined && profile.azp !== input.context.clientId)
      || typeof account.scope !== "string" || !account.scope.split(/\s+/).includes(GOOGLE_ANALYTICS_SCOPE)) return null;
    const result = grantSchema.safeParse({ ...claims(input.context, input.callbackSession), sessionBinding: nonce(), grantId: nonce(),
      refreshToken: account.refresh_token, scope: GOOGLE_ANALYTICS_SCOPE, issuedAt: now, absoluteExpiresAt: now + GRANT_MS });
    return result.success ? result.data : null;
  } catch { return null; }
}

export async function readGoogleAuthSession(request: Request, env: Variables) {
  if (!hasStrongAuthSecret(env.AUTH_SECRET)) return null;
  const name = `${getAdminCookieNamespace("admin-uat")}.session-token`;
  // Only this exact cookie is authoritative; never accept an Authorization header.
  return getToken({ req: { headers: { cookie: request.headers.get("cookie") ?? "" } },
    secret: env.AUTH_SECRET!, cookieName: name, salt: name, secureCookie: true });
}

export async function writeGoogleSessionGrant(grant: GoogleSessionGrant, env: Variables, write: GoogleCookieWriter, now = Date.now()) {
  const remaining = Math.floor((grant.absoluteExpiresAt - now) / 1_000);
  if (!hasStrongAuthSecret(env.AUTH_SECRET) || remaining <= 0 || remaining > GRANT_MS / 1_000) throw new Error("GOOGLE_SESSION_CONNECT_REQUIRED");
  const value = await encode({ token: grant, secret: env.AUTH_SECRET!, salt: GOOGLE_GRANT_COOKIE, maxAge: remaining });
  if (Buffer.byteLength(`${GOOGLE_GRANT_COOKIE}=${value}`, "utf8") > MAX_COOKIE_BYTES) throw new Error("GOOGLE_SESSION_CONNECT_REQUIRED");
  write(GOOGLE_GRANT_COOKIE, value, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: remaining });
}

export function validateGoogleSessionGrant(raw: unknown, context: Context, session: SessionToken, now = Date.now()): GoogleSessionGrant | null {
  const result = grantSchema.safeParse(raw);
  if (!result.success || !sessionMatches(session, context)) return null;
  const grant = result.data;
  if (grant.issuedAt > now || grant.absoluteExpiresAt <= now || grant.absoluteExpiresAt - grant.issuedAt !== GRANT_MS
    || session.googleConnectionBinding !== grant.sessionBinding) return null;
  const wanted = claims(context, session);
  return Object.entries(wanted).every(([key, value]) => grant[key as keyof typeof wanted] === value) ? grant : null;
}

async function readConnection(request: Request, actor: Actor, env: Variables) {
  const context = getGoogleUatContext(env, actor);
  if (!context || !isPostPublishAdminOriginAllowed(request, env, "admin-uat")) return null;
  try {
    const session = await readGoogleAuthSession(request, env);
    if (!session) return null;
    const raw = await getToken({ req: { headers: { cookie: request.headers.get("cookie") ?? "" } },
      secret: context.secret, cookieName: GOOGLE_GRANT_COOKIE, salt: GOOGLE_GRANT_COOKIE, secureCookie: true });
    const grant = validateGoogleSessionGrant(raw, context, session);
    return grant ? { context, grant } : null;
  } catch { return null; }
}

export async function getGoogleSessionReadiness(request: Request, actor: Actor, env: Variables): Promise<GoogleSessionReadiness> {
  if (!getGoogleUatContext(env, actor)) return { allowed: false, connected: false, reason: "configuration-required" };
  const connection = await readConnection(request, actor, env);
  return { allowed: true, connected: Boolean(connection), reason: connection ? "connected" : "connect-required" };
}

type RefreshResult = { accessToken: string; rotatedGrant: GoogleSessionGrant | null };
const refreshFlights = new Map<string, { until: number; result: Promise<RefreshResult> }>();
// Single-flight/result reuse is per process only; it is not a distributed lock.
export async function refreshConnectedGoogleGrant(grant: GoogleSessionGrant, context: Context,
  fetcher: typeof fetch = fetch, now = Date.now()): Promise<RefreshResult> {
  if (!grantSchema.safeParse(grant).success || grant.absoluteExpiresAt <= now || grant.issuedAt > now
    || grant.ownerHash !== context.ownerHash || grant.clientHash !== context.clientHash || grant.source !== context.source
    || grant.absoluteExpiresAt - grant.issuedAt !== GRANT_MS) throw new Error("GOOGLE_SESSION_CONNECT_REQUIRED");
  for (const [key, flight] of refreshFlights) if (flight.until <= now) refreshFlights.delete(key);
  const key = `${grant.grantId}:${digest(grant.refreshToken)}`;
  const existing = refreshFlights.get(key);
  if (existing) return existing.result;
  if (refreshFlights.size >= 64) throw new Error("GOOGLE_SESSION_CONNECT_REQUIRED");
  const flight = { until: Number.POSITIVE_INFINITY, result: Promise.resolve(null as unknown as RefreshResult) };
  flight.result = (async () => {
    try {
      const result = await refreshGoogleSessionAccessToken({ clientId: context.clientId, clientSecret: context.clientSecret,
        refreshToken: grant.refreshToken }, fetcher);
      return { accessToken: result.accessToken, rotatedGrant: result.refreshToken && result.refreshToken !== grant.refreshToken
        ? { ...grant, refreshToken: result.refreshToken } : null };
    } finally { flight.until = Date.now() + 5_000; }
  })();
  refreshFlights.set(key, flight);
  return flight.result;
}

export async function getConnectedGoogleAccessToken(request: Request, actor: Actor, env: Variables, write: GoogleCookieWriter,
  fetcher: typeof fetch = fetch) {
  if (request.method !== "POST") throw new Error("GOOGLE_SESSION_CONNECT_REQUIRED");
  const connection = await readConnection(request, actor, env);
  if (!connection) throw new Error("GOOGLE_SESSION_CONNECT_REQUIRED");
  const refreshed = await refreshConnectedGoogleGrant(connection.grant, connection.context, fetcher);
  if (refreshed.rotatedGrant) await writeGoogleSessionGrant(refreshed.rotatedGrant, env, write);
  // Errors never delete a cookie: a concurrent older request must not erase a newer grant.
  return refreshed.accessToken;
}
