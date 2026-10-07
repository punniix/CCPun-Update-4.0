import { NextResponse } from "next/server";

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
  // Execution belongs to the guarded private VPS CLI:
  // scripts/admin-background-worker.ts line-rich-menu. HTTP is never a reconciler invoker.
  return NextResponse.json({ error: "rich-menu-reconciler-unavailable" }, { status: 503, headers });
}
