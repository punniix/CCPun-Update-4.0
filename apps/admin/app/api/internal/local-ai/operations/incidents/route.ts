import { NextResponse } from "next/server";

import { readLocalAiIncidents } from "@/lib/admin/local-ai/database";
import { isN8nLocalAiRequestAuthorized } from "@/lib/admin/local-ai/service-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-cache, no-store", "X-Robots-Tag": "noindex, nofollow, noarchive" };

export async function GET(request: Request) {
  if (!isN8nLocalAiRequestAuthorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  const rawLimit = Number(new URL(request.url).searchParams.get("limit") ?? 25);
  const limit = Number.isInteger(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 25;
  try {
    return NextResponse.json({ incidents: await readLocalAiIncidents(limit) }, { headers });
  } catch {
    return NextResponse.json({ error: "local-ai-unavailable", retryable: true }, { status: 503, headers: { ...headers, "Retry-After": "30" } });
  }
}
