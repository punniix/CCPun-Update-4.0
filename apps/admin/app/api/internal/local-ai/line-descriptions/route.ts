import { NextResponse } from "next/server";
import { z } from "zod";

import { listPublishedArticlesMissingLineDescription } from "@/lib/admin/line/description-optimization";
import { isN8nLocalAiRequestAuthorized } from "@/lib/admin/local-ai/service-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const responseHeaders = {
  "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(request: Request) {
  if (!isN8nLocalAiRequestAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: responseHeaders });
  }
  const parsedLimit = z.coerce.number().int().min(1).max(20).safeParse(new URL(request.url).searchParams.get("limit") ?? "10");
  if (!parsedLimit.success) return NextResponse.json({ error: "invalid-limit" }, { status: 400, headers: responseHeaders });
  try {
    const items = await listPublishedArticlesMissingLineDescription(parsedLimit.data);
    return NextResponse.json({ items }, { headers: responseHeaders });
  } catch {
    return NextResponse.json({ error: "line-description-source-unavailable", retryable: true }, { status: 503, headers: responseHeaders });
  }
}

export function POST() {
  return new NextResponse(null, { status: 404, headers: responseHeaders });
}
