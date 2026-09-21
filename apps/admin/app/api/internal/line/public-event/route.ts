import { NextResponse } from "next/server";
import { recordLinePublicEvent } from "@/lib/admin/line/public-event-ingestion";
import { isProductionWebServiceRequestAuthorized } from "@/lib/admin/line/web-service-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

export async function POST(request: Request) {
  if (!(await isProductionWebServiceRequestAuthorized(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "unsupported-media-type" }, { status: 415, headers });
  }
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > 16_384) {
    return NextResponse.json({ error: "payload-too-large" }, { status: 413, headers });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400, headers });
  }

  const result = await recordLinePublicEvent(body);
  if (result.ok) return NextResponse.json({ status: "recorded" }, { status: 202, headers });
  if (result.status === "invalid") {
    return NextResponse.json({ error: "invalid-safe-event" }, { status: 400, headers });
  }
  if (result.status === "rejected") {
    return NextResponse.json({ error: "event-rejected" }, { status: 409, headers });
  }
  return NextResponse.json({ error: "event-store-unavailable" }, { status: 503, headers });
}

export function GET() {
  return new NextResponse(null, { status: 404, headers });
}
