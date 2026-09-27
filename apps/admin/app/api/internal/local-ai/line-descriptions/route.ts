import { NextResponse } from "next/server";
import { z } from "zod";

import {
  listPublishedArticlesMissingLineDescription,
  readPublishedArticleLineDescription,
} from "@/lib/admin/line/description-optimization";
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
  const searchParams = new URL(request.url).searchParams;
  const sourceId = searchParams.get("sourceId");
  if (sourceId) {
    try {
      const article = await readPublishedArticleLineDescription(sourceId);
      if (!article) {
        return NextResponse.json({ error: "not-found" }, { status: 404, headers: responseHeaders });
      }
      return NextResponse.json({ article }, { headers: responseHeaders });
    } catch {
      return NextResponse.json(
        { error: "line-description-source-unavailable", retryable: true },
        { status: 503, headers: responseHeaders },
      );
    }
  }

  const parsedLimit = z.coerce.number().int().min(1).max(20).safeParse(searchParams.get("limit") ?? "10");
  if (!parsedLimit.success) return NextResponse.json({ error: "invalid-limit" }, { status: 400, headers: responseHeaders });
  const parsedSlug = z.string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(96)
    .optional()
    .safeParse(searchParams.get("slug") ?? undefined);
  if (!parsedSlug.success) return NextResponse.json({ error: "invalid-slug" }, { status: 400, headers: responseHeaders });
  try {
    const items = await listPublishedArticlesMissingLineDescription(parsedLimit.data, parsedSlug.data);
    return NextResponse.json({ items }, { headers: responseHeaders });
  } catch {
    return NextResponse.json({ error: "line-description-source-unavailable", retryable: true }, { status: 503, headers: responseHeaders });
  }
}

export function POST() {
  return new NextResponse(null, { status: 404, headers: responseHeaders });
}
