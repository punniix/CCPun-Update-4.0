import { NextResponse } from "next/server";
import { probeLineBridgeFromWeb } from "@/lib/runtime/line-bridge-probe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

export async function GET(request: Request) {
  if (process.env.CCPUN_DEPLOYMENT_PROVIDER?.trim().toLowerCase() === "hostinger") {
    return new NextResponse(null, { status: 404, headers });
  }
  const result = await probeLineBridgeFromWeb(request);
  return NextResponse.json(result, {
    status: result.status === "unauthorized" ? 401 : result.status === "ready" ? 200 : 503,
    headers,
  });
}
