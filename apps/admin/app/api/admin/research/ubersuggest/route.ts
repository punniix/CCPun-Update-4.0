import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminEnvironment } from "@/lib/admin/environment";
import { getAdminIdentity } from "@/lib/admin/identity";
import { evaluateAdminAction } from "@/lib/admin/policy";
import { hasAdminPermission } from "@/lib/admin/rbac";
import { createResearchSnapshot, findFreshResearchSnapshot } from "@/lib/admin/research";
import { fetchUbersuggestResearch } from "@/lib/admin/ubersuggest";

const inputSchema = z.object({ keyword: z.string().trim().min(1).max(300) });
const inFlight = new Map<string, Promise<{ id: string; reused: boolean }>>();
const recentProviderRequests: number[] = [];
const PROVIDER_RATE_WINDOW_MS = 60_000;
const PROVIDER_RATE_LIMIT = 6;
let providerRequestsInFlight = 0;

function reserveProviderRequest(now = Date.now()) {
  while (recentProviderRequests[0] && recentProviderRequests[0] <= now - PROVIDER_RATE_WINDOW_MS) recentProviderRequests.shift();
  if (providerRequestsInFlight >= 1 || recentProviderRequests.length >= PROVIDER_RATE_LIMIT) {
    const retryAt = recentProviderRequests[0] ? recentProviderRequests[0] + PROVIDER_RATE_WINDOW_MS : now + 1_000;
    return Math.max(1, Math.ceil((retryAt - now) / 1_000));
  }
  providerRequestsInFlight += 1;
  recentProviderRequests.push(now);
  return 0;
}

async function fetchAndSave(keyword: string, actor: string, requestId: string) {
  const fresh = await findFreshResearchSnapshot("ubersuggest", keyword);
  if (fresh) return { id: fresh.id, reused: true };
  const retryAfter = reserveProviderRequest();
  if (retryAfter) throw new Error(`UBERSUGGEST_RATE_LIMITED:${retryAfter}`);
  try {
    const normalized = await fetchUbersuggestResearch(keyword);
    const saved = await createResearchSnapshot(normalized, { actor, actorType: "human", requestId });
    return { id: saved._id, reused: false };
  } finally {
    providerRequestsInFlight -= 1;
  }
}

export async function POST(request: Request) {
  const identity = await getAdminIdentity();
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const policy = evaluateAdminAction({ actorType: identity.actorType, role: identity.role, action: "research:create", environment: getAdminEnvironment() });
  if (!policy.allowed || identity.actorType !== "human" || !hasAdminPermission(identity.role, "research:provider-query")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid-input" }, { status: 400 });

  const requestId = randomUUID();
  const key = parsed.data.keyword.toLocaleLowerCase("th-TH").replace(/\s+/g, " ").trim();
  // ponytail: one local owner process; a per-key promise prevents duplicate quota use.
  const task = inFlight.get(key) ?? fetchAndSave(parsed.data.keyword, identity.actor, requestId);
  inFlight.set(key, task);
  try {
    const result = await task;
    return NextResponse.json({ ...result, trustClass: "untrusted-external-data", requestId }, { status: result.reused ? 200 : 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code.startsWith("UBERSUGGEST_RATE_LIMITED:")) {
      const retryAfter = code.split(":")[1] || "60";
      return NextResponse.json({ error: "provider-rate-limited", requestId }, { status: 429, headers: { "Retry-After": retryAfter } });
    }
    if (code === "UBERSUGGEST_AUTH_REQUIRED") return NextResponse.json({ error: "provider-auth-required", requestId }, { status: 401 });
    if (code === "UBERSUGGEST_TIMEOUT") return NextResponse.json({ error: "provider-timeout", requestId }, { status: 504 });
    if (code === "UBERSUGGEST_INVALID_RESPONSE") return NextResponse.json({ error: "provider-invalid-response", requestId }, { status: 502 });
    if (["SANITY_WRITE_NOT_CONFIGURED", "ADMIN_DATABASE_NOT_CONFIGURED"].includes(code)) return NextResponse.json({ error: "research-write-not-configured", requestId }, { status: 503 });
    return NextResponse.json({ error: "provider-tool-failed", requestId }, { status: 502 });
  } finally {
    if (inFlight.get(key) === task) inFlight.delete(key);
  }
}
