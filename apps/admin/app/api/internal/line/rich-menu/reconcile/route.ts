import { NextResponse } from "next/server";

import { reconcileDesiredLineRichMenu } from "@/lib/admin/line/rich-menu-reconciler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    return NextResponse.json({ error: "rich-menu-reconciler-not-configured" }, { status: 503, headers });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  }
  try {
    const result = await reconcileDesiredLineRichMenu();
    return NextResponse.json(result, {
      status: result.status === "provider_unavailable" ? 503 : 200,
      headers,
    });
  } catch {
    return NextResponse.json({ status: "reconcile_failed" }, { status: 503, headers });
  }
}
