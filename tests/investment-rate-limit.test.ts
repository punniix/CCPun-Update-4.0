import assert from "node:assert/strict";
import test from "node:test";
import { RATE_LIMIT_MESSAGE } from "../features/investment-allocation/domain/copy";
import {
  bucketKeyForAddress,
  clientKeyFromHeaders,
  createTrustedProxyList,
  normalizeAddress,
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

test("client key comes from the trusted proxy hop, never from a client-supplied X-Forwarded-For entry", () => {
  const key = (headers: Record<string, string>) => clientKeyFromHeaders(new Headers(headers), createTrustedProxyList(""));
  // Direct to the Hostinger edge: the edge appended the visitor it saw on the right.
  assert.equal(key({ "x-forwarded-for": "203.0.113.7" }), "203.0.113.7");
  assert.equal(key({ "x-forwarded-for": "198.51.100.66, 203.0.113.7" }), "203.0.113.7", "a forged left entry is ignored");
  // Visitor -> Cloudflare -> Hostinger edge -> internal hop.
  assert.equal(key({ "x-forwarded-for": "203.0.113.7, 162.158.1.2, 10.0.0.5" }), "203.0.113.7");
  assert.equal(key({ "x-forwarded-for": "1.1.1.1, 9.9.9.9, 203.0.113.7, 2606:4700::6810:84e5, 127.0.0.1" }), "203.0.113.7");
  // Rotating the forged value no longer mints new per-client buckets.
  const rotated = new Set(Array.from({ length: 50 }, (_, i) => key({ "x-forwarded-for": `192.0.2.${i}, 203.0.113.7, 172.70.1.1` })));
  assert.deepEqual([...rotated], ["203.0.113.7"]);
});

test("headers a visitor can send straight to the origin never choose the bucket", () => {
  const key = (headers: Record<string, string>) => clientKeyFromHeaders(new Headers(headers), createTrustedProxyList(""));
  assert.equal(key({ "x-real-ip": "2001:db8::1" }), "unknown");
  assert.equal(key({ "cf-connecting-ip": "203.0.113.50" }), "unknown");
  assert.equal(key({ "cf-connecting-ip": "203.0.113.50", "x-forwarded-for": "203.0.113.7" }), "203.0.113.7");
  assert.equal(key({}), "unknown");
});

test("malformed, oversized or all-internal chains fall back to the shared unknown bucket", () => {
  const key = (value: string) => clientKeyFromHeaders(new Headers({ "x-forwarded-for": value }), createTrustedProxyList(""));
  assert.equal(key("<script>"), "unknown");
  assert.equal(key("203.0.113.7, not-an-ip, 10.0.0.1"), "unknown", "a malformed hop ends the trusted chain");
  assert.equal(key("10.0.0.1, 127.0.0.1"), "unknown");
  assert.equal(key(Array.from({ length: 40 }, () => "203.0.113.7").join(",")), "unknown");
  const padded = Array.from({ length: 31 }, () => `${" ".repeat(70)}203.0.113.7`).join(",");
  assert.ok(padded.length > 2048);
  assert.equal(key(padded), "unknown", "an oversized header is not parsed");
});

test("addresses are normalized and IPv6 visitors share one bucket per /64", () => {
  const key = (value: string) => clientKeyFromHeaders(new Headers({ "x-forwarded-for": value }), createTrustedProxyList(""));
  assert.equal(normalizeAddress("[2001:db8::1]:443"), "2001:db8::1");
  assert.equal(normalizeAddress("203.0.113.7:51234"), "203.0.113.7");
  assert.equal(normalizeAddress("::ffff:203.0.113.7"), "203.0.113.7");
  assert.equal(normalizeAddress("example.com"), null);
  assert.equal(key("2001:db8:aaaa:bbbb::1"), "2001:db8:aaaa:bbbb::/64");
  assert.equal(key("2001:db8:aaaa:bbbb:ffff:1:2:3, 2400:cb00::1"), "2001:db8:aaaa:bbbb::/64");
  assert.equal(bucketKeyForAddress("2001:0DB8:0:0001::5".toLowerCase()), "2001:db8:0:1::/64");
  assert.equal(key("::ffff:203.0.113.7"), "203.0.113.7");
});

test("extra trusted hops can be configured without a code change", () => {
  const withHop = createTrustedProxyList("198.51.100.0/24, not-a-cidr, 2001:db8:ffff::/48");
  assert.equal(clientKeyFromHeaders(new Headers({ "x-forwarded-for": "203.0.113.7, 198.51.100.9" }), withHop), "203.0.113.7");
  assert.equal(clientKeyFromHeaders(new Headers({ "x-forwarded-for": "203.0.113.7, 198.51.100.9" }), createTrustedProxyList("")), "198.51.100.9");
  assert.equal(clientKeyFromHeaders(new Headers({ "x-forwarded-for": "203.0.113.8, 2001:db8:ffff:1::9" }), withHop), "203.0.113.8");
});

test("forged X-Forwarded-For values cannot escape a refused per-client bucket", () => {
  const limiter = new InvestmentApiRateLimiter({ capacity: 2, refillPerSecond: 0.001 }, { capacity: 1000, refillPerSecond: 10 });
  const request = (forged: string) => new Request("https://example.invalid/api/investment-allocation/amcs", {
    headers: { "x-forwarded-for": `${forged}, 203.0.113.9, 162.158.0.10` },
  });
  assert.equal(enforceInvestmentApiRateLimit(request("192.0.2.1"), "amcs", limiter), null);
  assert.equal(enforceInvestmentApiRateLimit(request("192.0.2.2"), "amcs", limiter), null);
  assert.equal(enforceInvestmentApiRateLimit(request("192.0.2.3"), "amcs", limiter)?.status, 429);
  assert.equal(enforceInvestmentApiRateLimit(request("192.0.2.4"), "amcs", limiter)?.status, 429);
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
