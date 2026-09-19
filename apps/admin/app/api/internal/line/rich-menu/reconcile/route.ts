import { NextResponse } from "next/server";

import { reconcileDesiredLineRichMenu } from "@/lib/admin/line/rich-menu-reconciler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

export async function GET() {
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
