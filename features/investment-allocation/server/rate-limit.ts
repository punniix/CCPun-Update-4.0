import { BlockList, isIP } from "node:net";

import { RATE_LIMIT_MESSAGE } from "../domain/copy";

// In-memory token buckets for the public /api/investment-allocation/* proxies of
// the SEC Open API. Two layers are checked together and consumed only when both
// allow the request:
// - per client IP: fairness between visitors;
// - global (per Node instance): the hard backstop that protects the SEC
//   subscription quota even when a client rotates its address.
//
// Limitation (documented, accepted for UAT/v5 launch): state lives in this Node
// process only. Several instances or a restart each start with full buckets, so
// the effective ceiling is "limit x instances". The state is kept on globalThis
// so every route bundle in the same process shares one set of buckets.

export type InvestmentApiRoute = "amcs" | "catalog" | "detail" | "funds";

export type TokenBucketPolicy = { capacity: number; refillPerSecond: number };

type Bucket = { tokens: number; updatedAt: number };

export const PER_CLIENT_POLICY: TokenBucketPolicy = { capacity: 30, refillPerSecond: 0.5 }; // 30 burst, 30/min
export const GLOBAL_POLICY: TokenBucketPolicy = { capacity: 240, refillPerSecond: 4 }; // 240 burst, 240/min
// Cost reflects upstream fan-out: amcs is one (daily-cached) list; a catalog page
// may scan several SEC pages; detail fans out to five SEC endpoints; funds runs a
// catalog scan plus up to eight risk-spectrum lookups.
export const ROUTE_COST: Record<InvestmentApiRoute, number> = { amcs: 1, catalog: 2, detail: 3, funds: 3 };
export const MAX_TRACKED_CLIENTS = 5000;

export class TokenBucketStore {
  private readonly buckets = new Map<string, Bucket>();

  constructor(private readonly policy: TokenBucketPolicy, private readonly maxKeys = MAX_TRACKED_CLIENTS) {}

  get size(): number {
    return this.buckets.size;
  }

  available(key: string, now: number): number {
    const bucket = this.buckets.get(key);
    if (!bucket) return this.policy.capacity;
    const elapsed = Math.max(0, now - bucket.updatedAt) / 1000;
    return Math.min(this.policy.capacity, bucket.tokens + elapsed * this.policy.refillPerSecond);
  }

  /** Seconds until `cost` tokens are available (0 when available now). */
  waitSeconds(key: string, cost: number, now: number): number {
    const missing = cost - this.available(key, now);
    return missing <= 0 ? 0 : Math.ceil(missing / this.policy.refillPerSecond);
  }

  consume(key: string, cost: number, now: number): void {
    const tokens = this.available(key, now) - cost;
    this.buckets.delete(key);
    this.buckets.set(key, { tokens, updatedAt: now });
    if (this.buckets.size > this.maxKeys) this.evict(now);
  }

  private evict(now: number): void {
    // Full buckets carry no state worth keeping; drop them first.
    for (const key of this.buckets.keys()) {
      if (this.available(key, now) >= this.policy.capacity) this.buckets.delete(key);
    }
    // Then the least recently used keys (Map preserves insertion order).
    for (const key of this.buckets.keys()) {
      if (this.buckets.size <= this.maxKeys) break;
      this.buckets.delete(key);
    }
  }
}

export type RateLimitDecision = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export class InvestmentApiRateLimiter {
  readonly clients: TokenBucketStore;
  readonly global: TokenBucketStore;

  constructor(clientPolicy = PER_CLIENT_POLICY, globalPolicy = GLOBAL_POLICY, maxKeys = MAX_TRACKED_CLIENTS) {
    this.clients = new TokenBucketStore(clientPolicy, maxKeys);
    this.global = new TokenBucketStore(globalPolicy, 1);
  }

  take(clientKey: string, route: InvestmentApiRoute, now = Date.now()): RateLimitDecision {
    const cost = ROUTE_COST[route];
    const wait = Math.max(this.clients.waitSeconds(clientKey, cost, now), this.global.waitSeconds("global", cost, now));
    if (wait > 0) return { allowed: false, retryAfterSeconds: Math.max(1, wait) };
    this.clients.consume(clientKey, cost, now);
    this.global.consume("global", cost, now);
    return { allowed: true };
  }
}

// Client identity for the per-client bucket (T4, 2026-10-25).
//
// X-Forwarded-For is a list that every proxy appends its peer address to, so
// only the right-hand end is written by infrastructure we trust. A visitor can
// prepend anything, so the left-most entry (and any X-Real-IP / CF-Connecting-IP
// the visitor sends straight to the origin) must never pick the bucket.
//
// The ingress chain is visitor -> Cloudflare (ccpun.com, test.ccpun.com) ->
// Hostinger edge -> Node. Walking X-Forwarded-For from the right and skipping
// every address that belongs to a trusted hop (Cloudflare's published ranges,
// loopback/private/CGNAT/link-local addresses used inside Hostinger, plus any
// CIDR in CCPUN_TRUSTED_PROXY_CIDRS) yields the address the first trusted hop
// actually saw. With no forwarded chain at all (local dev, direct calls) every
// caller shares the "unknown" bucket, which is the conservative choice.
// IPv6 visitors are bucketed by /64 so rotating addresses inside one
// allocation does not mint new buckets.

const MAX_FORWARDED_ENTRIES = 32;
const MAX_FORWARDED_HEADER_LENGTH = 2048;

// https://www.cloudflare.com/ips/ (checked 2026-10-25). A stale list only makes a
// new Cloudflare egress address look like a visitor, which is fail-safe: those
// visitors share one bucket and the global bucket still applies.
export const CLOUDFLARE_PROXY_CIDRS = [
  "173.245.48.0/20", "103.21.244.0/22", "103.22.200.0/22", "103.31.4.0/22", "141.101.64.0/18",
  "108.162.192.0/18", "190.93.240.0/20", "188.114.96.0/20", "197.234.240.0/22", "198.41.128.0/17",
  "162.158.0.0/15", "104.16.0.0/13", "104.24.0.0/14", "172.64.0.0/13", "131.0.72.0/22",
  "2400:cb00::/32", "2606:4700::/32", "2803:f800::/32", "2405:b500::/32", "2405:8100::/32",
  "2a06:98c0::/29", "2c0f:f248::/32",
] as const;

// Addresses that never belong to a public visitor: hops inside the hosting platform.
export const INTERNAL_PROXY_CIDRS = [
  "127.0.0.0/8", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "100.64.0.0/10", "169.254.0.0/16",
  "::1/128", "fc00::/7", "fe80::/10",
] as const;

function addCidr(list: BlockList, cidr: string): boolean {
  const [address, bits] = cidr.trim().split("/");
  const family = isIP(address ?? "");
  const prefix = Number(bits);
  if (!family || !Number.isInteger(prefix) || prefix < 0 || prefix > (family === 4 ? 32 : 128)) return false;
  list.addSubnet(address, prefix, family === 4 ? "ipv4" : "ipv6");
  return true;
}

export function createTrustedProxyList(extraCidrs: string | undefined = process.env.CCPUN_TRUSTED_PROXY_CIDRS): BlockList {
  const list = new BlockList();
  for (const cidr of [...CLOUDFLARE_PROXY_CIDRS, ...INTERNAL_PROXY_CIDRS]) addCidr(list, cidr);
  for (const cidr of (extraCidrs ?? "").split(",")) if (cidr.trim()) addCidr(list, cidr);
  return list;
}

let defaultTrustedProxies: BlockList | undefined;

/** Strip brackets, a port and an IPv4-mapped IPv6 prefix; return null for anything that is not an IP. */
export function normalizeAddress(raw: string): string | null {
  let value = raw.trim();
  const bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(value);
  if (bracketed) value = bracketed[1];
  else if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(value)) value = value.slice(0, value.lastIndexOf(":"));
  value = value.replace(/%.*$/, "");
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(value);
  if (mapped) value = mapped[1];
  return isIP(value) ? value.toLowerCase() : null;
}

function isTrusted(address: string, trusted: BlockList): boolean {
  return trusted.check(address, isIP(address) === 4 ? "ipv4" : "ipv6");
}

/** Bucket key for a visitor address: IPv4 as-is, IPv6 by its /64 prefix. */
export function bucketKeyForAddress(address: string): string {
  if (isIP(address) !== 6) return address;
  const [head, tail = ""] = address.split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const groups = address.includes("::")
    ? [...left, ...Array(8 - left.length - right.length).fill("0"), ...right]
    : left;
  return `${groups.slice(0, 4).map((group) => (Number.parseInt(group || "0", 16) || 0).toString(16)).join(":")}::/64`;
}

/**
 * Per-client bucket key, taken only from the address the first trusted proxy
 * appended to X-Forwarded-For. Client-supplied X-Real-IP, CF-Connecting-IP and
 * left-hand X-Forwarded-For entries are ignored.
 */
export function clientKeyFromHeaders(headers: Headers, trusted: BlockList = (defaultTrustedProxies ??= createTrustedProxyList())): string {
  const header = headers.get("x-forwarded-for");
  if (!header || header.length > MAX_FORWARDED_HEADER_LENGTH) return "unknown";
  const entries = header.split(",");
  if (entries.length > MAX_FORWARDED_ENTRIES) return "unknown";
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const address = normalizeAddress(entries[index] ?? "");
    // A malformed hop means the chain cannot be trusted past this point.
    if (!address) return "unknown";
    if (!isTrusted(address, trusted)) return bucketKeyForAddress(address);
  }
  // Every hop is a trusted proxy (for example a request from inside the platform).
  return "unknown";
}

const STORE_KEY = Symbol.for("ccpun.investmentAllocation.rateLimiter.v1");

function sharedLimiter(): InvestmentApiRateLimiter {
  const holder = globalThis as typeof globalThis & { [STORE_KEY]?: InvestmentApiRateLimiter };
  holder[STORE_KEY] ??= new InvestmentApiRateLimiter();
  return holder[STORE_KEY];
}

export function rateLimitedResponse(retryAfterSeconds: number): Response {
  return Response.json(
    { error: "rate_limited", message: RATE_LIMIT_MESSAGE },
    {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(retryAfterSeconds),
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

/** Returns a 429 Response when the request must be refused, otherwise null. */
export function enforceInvestmentApiRateLimit(
  request: Request,
  route: InvestmentApiRoute,
  limiter: InvestmentApiRateLimiter = sharedLimiter(),
): Response | null {
  const decision = limiter.take(clientKeyFromHeaders(request.headers), route);
  return decision.allowed ? null : rateLimitedResponse(decision.retryAfterSeconds);
}
