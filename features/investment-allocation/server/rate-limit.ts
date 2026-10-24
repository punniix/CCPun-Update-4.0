import { RATE_LIMIT_MESSAGE } from "../domain/copy";

// In-memory token buckets for the public /api/investment-allocation/* proxies of
// the SEC Open API. Two layers are checked together and consumed only when both
// allow the request:
// - per client IP: fairness between visitors;
// - global (per Node instance): the hard backstop that protects the SEC
//   subscription quota even when a client rotates or spoofs its address.
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

const MAX_CLIENT_KEY_LENGTH = 64;
const CLIENT_ADDRESS_PATTERN = /^[0-9A-Fa-f:.]{2,64}$/;

/**
 * Best-effort client address from the reverse proxy. The left-most
 * X-Forwarded-For entry can be forged by a client; that only lets it move
 * between per-client buckets, never past the global bucket.
 */
export function clientKeyFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
  const candidate = forwarded || headers.get("x-real-ip")?.trim() || "";
  const normalized = candidate.slice(0, MAX_CLIENT_KEY_LENGTH);
  return CLIENT_ADDRESS_PATTERN.test(normalized) ? normalized : "unknown";
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
