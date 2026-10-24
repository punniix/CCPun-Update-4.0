import assert from "node:assert/strict";
import test from "node:test";
import { RATE_LIMIT_MESSAGE } from "../features/investment-allocation/domain/copy";
import {
  clientKeyFromHeaders,
  enforceInvestmentApiRateLimit,
  InvestmentApiRateLimiter,
  ROUTE_COST,
  TokenBucketStore,
} from "../features/investment-allocation/server/rate-limit";

test("per-client bucket allows its burst, refuses the next request and refills over time", () => {
  const limiter = new InvestmentApiRateLimiter({ capacity: 4, refillPerSecond: 1 }, { capacity: 100, refillPerSecond: 10 });
  const now = 1_000_000;
  for (let i = 0; i < 4; i++) assert.deepEqual(limiter.take("203.0.113.1", "amcs", now), { allowed: true }, `request ${i}`);
  assert.deepEqual(limiter.take("203.0.113.1", "amcs", now), { allowed: false, retryAfterSeconds: 1 });
  assert.deepEqual(limiter.take("203.0.113.2", "amcs", now), { allowed: true }, "other clients keep their own bucket");
  assert.deepEqual(limiter.take("203.0.113.1", "amcs", now + 1000), { allowed: true }, "one token refills per second");
});

test("route cost reflects SEC fan-out and refusals do not consume tokens", () => {
  assert.deepEqual(ROUTE_COST, { amcs: 1, catalog: 2, detail: 3, funds: 3 });
  const limiter = new InvestmentApiRateLimiter({ capacity: 4, refillPerSecond: 1 }, { capacity: 100, refillPerSecond: 10 });
  const now = 5_000;
  assert.equal(limiter.take("client", "detail", now).allowed, true);
  const refused = limiter.take("client", "detail", now);
  assert.deepEqual(refused, { allowed: false, retryAfterSeconds: 2 });
  assert.equal(limiter.take("client", "amcs", now).allowed, true, "the refused detail call left its remaining token");
});

test("global bucket is the backstop even when every request uses a new client address", () => {
  const limiter = new InvestmentApiRateLimiter({ capacity: 30, refillPerSecond: 1 }, { capacity: 5, refillPerSecond: 1 });
  const now = 9_000;
  for (let i = 0; i < 5; i++) assert.equal(limiter.take(`198.51.100.${i}`, "amcs", now).allowed, true);
  const refused = limiter.take("198.51.100.99", "amcs", now);
  assert.equal(refused.allowed, false);
  assert.equal(limiter.clients.available("198.51.100.99", now), 30, "a globally refused request does not charge the client");
});

test("tracked client keys are bounded", () => {
  const store = new TokenBucketStore({ capacity: 2, refillPerSecond: 0.001 }, 3);
  for (let i = 0; i < 10; i++) store.consume(`k${i}`, 1, 0);
  assert.ok(store.size <= 3, `size ${store.size}`);
});

test("client key uses the first forwarded address and rejects malformed values", () => {
  assert.equal(clientKeyFromHeaders(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" })), "203.0.113.7");
  assert.equal(clientKeyFromHeaders(new Headers({ "x-real-ip": "2001:db8::1" })), "2001:db8::1");
  assert.equal(clientKeyFromHeaders(new Headers({ "x-forwarded-for": "<script>" })), "unknown");
  assert.equal(clientKeyFromHeaders(new Headers()), "unknown");
});

test("refused requests get an uncached Thai 429 with Retry-After", async () => {
  const limiter = new InvestmentApiRateLimiter({ capacity: 1, refillPerSecond: 0.5 }, { capacity: 100, refillPerSecond: 10 });
  const request = () => new Request("https://example.invalid/api/investment-allocation/amcs", { headers: { "x-forwarded-for": "203.0.113.9" } });
  assert.equal(enforceInvestmentApiRateLimit(request(), "amcs", limiter), null);
  const response = enforceInvestmentApiRateLimit(request(), "amcs", limiter);
  assert.ok(response);
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.ok(Number(response.headers.get("Retry-After")) >= 1);
  assert.deepEqual(await response.json(), { error: "rate_limited", message: RATE_LIMIT_MESSAGE });
});
