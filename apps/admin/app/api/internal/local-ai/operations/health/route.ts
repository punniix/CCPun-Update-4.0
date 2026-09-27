import { NextResponse } from "next/server";

import { readLocalAiBridgeHealth } from "@/lib/admin/local-ai/database";
import { isN8nLocalAiRequestAuthorized } from "@/lib/admin/local-ai/service-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-cache, no-store", "X-Robots-Tag": "noindex, nofollow, noarchive" };

export async function GET(request: Request) {
  if (!isN8nLocalAiRequestAuthorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  const model = await readLocalAiBridgeHealth();
  if (model.status !== "ready") return NextResponse.json({ status: "unavailable", retryable: true }, { status: 503, headers: { ...headers, "Retry-After": "30" } });
  return NextResponse.json(model, { headers });
}
