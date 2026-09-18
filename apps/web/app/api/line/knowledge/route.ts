import { NextResponse } from "next/server";
import { resolveSafeKnowledge } from "../../../../lib/line/safe-knowledge-runtime";

export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Content-Type-Options": "nosniff",
};

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "unsupported-media_type" }, { status: 415, headers });
  }
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > 8_192) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413, headers });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, headers });
  }

  const decision = await resolveSafeKnowledge(body);
  if (!decision) {
    return NextResponse.json({ error: "unsafe_or_invalid_request" }, { status: 400, headers });
  }
  return NextResponse.json({ decision }, { status: 200, headers });
}

export function GET() {
  return new NextResponse(null, { status: 404, headers });
}
