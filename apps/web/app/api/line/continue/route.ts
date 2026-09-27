import { NextResponse, type NextRequest } from "next/server";
import { createLineContinueFromSafeJourney } from "../../../../lib/line/journey-bridge";

export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Content-Type-Options": "nosniff",
};

export async function POST(request: NextRequest) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "unsupported-media-type" }, { status: 415, headers });
  }
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > 16_384) {
    return NextResponse.json({ error: "payload-too-large" }, { status: 413, headers });
  }
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "invalid-json" }, { status: 400, headers }); }
  const result = await createLineContinueFromSafeJourney(body);
  if (!result.ok || !result.href || !result.label) {
    return NextResponse.json({ error: result.unavailableReason ?? "invalid-safe-journey" }, { status: 400, headers });
  }
  return NextResponse.json({
    href: result.href,
    label: result.label,
    stored: result.stored,
    unavailableReason: result.unavailableReason,
  }, { status: 200, headers });
}

export function GET() {
  return new NextResponse(null, { status: 404, headers });
}
