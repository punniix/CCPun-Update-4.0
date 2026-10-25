import "server-only";

import { BlockList, isIP } from "node:net";

// Per-process token buckets for /api/result-email/* (same accepted limitation as the Investment
// Allocation proxies: state lives in this Node process only). The public Web entry closure may not
// import the separated Investment feature, so the trusted-proxy client key below mirrors
// features/investment-allocation/server/rate-limit.ts (T4, 2026-10-25). Follow-up: promote both to
// one shared lib/ module in a dedicated change.

type Policy = { capacity: number; refillPerSecond: number };
type Bucket = { tokens: number; updatedAt: number };

export class TokenBuckets {
  private readonly buckets = new Map<string, Bucket>();
  constructor(private readonly policy: Policy, private readonly maxKeys = 5000) {}

  private available(key: string, now: number): number {
    const bucket = this.buckets.get(key);
    if (!bucket) return this.policy.capacity;
    return Math.min(this.policy.capacity, bucket.tokens + (Math.max(0, now - bucket.updatedAt) / 1000) * this.policy.refillPerSecond);
  }

  canTake(key: string, now: number): boolean {
    return this.available(key, now) >= 1;
  }

  take(key: string, now: number): void {
    const tokens = this.available(key, now) - 1;
    this.buckets.delete(key);
    this.buckets.set(key, { tokens, updatedAt: now });
    if (this.buckets.size > this.maxKeys) {
      for (const candidate of this.buckets.keys()) {
        if (this.buckets.size <= this.maxKeys) break;
        this.buckets.delete(candidate);
      }
    }
  }
}

// https://www.cloudflare.com/ips/ (same list and date as the Investment Allocation limiter).
const TRUSTED_PROXY_CIDRS = [
  "173.245.48.0/20", "103.21.244.0/22", "103.22.200.0/22", "103.31.4.0/22", "141.101.64.0/18",
  "108.162.192.0/18", "190.93.240.0/20", "188.114.96.0/20", "197.234.240.0/22", "198.41.128.0/17",
  "162.158.0.0/15", "104.16.0.0/13", "104.24.0.0/14", "172.64.0.0/13", "131.0.72.0/22",
  "2400:cb00::/32", "2606:4700::/32", "2803:f800::/32", "2405:b500::/32", "2405:8100::/32",
  "2a06:98c0::/29", "2c0f:f248::/32",
  "127.0.0.0/8", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "100.64.0.0/10", "169.254.0.0/16",
  "::1/128", "fc00::/7", "fe80::/10",
];

let trusted: BlockList | undefined;
function trustedProxies(): BlockList {
  if (trusted) return trusted;
  trusted = new BlockList();
  for (const cidr of [...TRUSTED_PROXY_CIDRS, ...(process.env.CCPUN_TRUSTED_PROXY_CIDRS ?? "").split(",")]) {
    const [address, bits] = cidr.trim().split("/");
    const family = isIP(address ?? "");
    const prefix = Number(bits);
    if (family && Number.isInteger(prefix) && prefix >= 0 && prefix <= (family === 4 ? 32 : 128)) trusted.addSubnet(address, prefix, family === 4 ? "ipv4" : "ipv6");
  }
  return trusted;
}

function normalizeAddress(raw: string): string | null {
  let value = raw.trim();
  const bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(value);
  if (bracketed) value = bracketed[1];
  else if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(value)) value = value.slice(0, value.lastIndexOf(":"));
  value = value.replace(/%.*$/, "");
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(value);
  if (mapped) value = mapped[1];
  return isIP(value) ? value.toLowerCase() : null;
}

function bucketKey(address: string): string {
  if (isIP(address) !== 6) return address;
  const [head, tail = ""] = address.split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const groups = address.includes("::") ? [...left, ...Array(8 - left.length - right.length).fill("0"), ...right] : left;
  return `${groups.slice(0, 4).map((group) => (Number.parseInt(group || "0", 16) || 0).toString(16)).join(":")}::/64`;
}

/** Address the first trusted hop appended to X-Forwarded-For; visitor-supplied left entries never pick the bucket. */
export function clientKeyFromHeaders(headers: Headers): string {
  const header = headers.get("x-forwarded-for");
  if (!header || header.length > 2048) return "unknown";
  const entries = header.split(",");
  if (entries.length > 32) return "unknown";
  const list = trustedProxies();
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const address = normalizeAddress(entries[index] ?? "");
    if (!address) return "unknown";
    if (!list.check(address, isIP(address) === 4 ? "ipv4" : "ipv6")) return bucketKey(address);
  }
  return "unknown";
}
