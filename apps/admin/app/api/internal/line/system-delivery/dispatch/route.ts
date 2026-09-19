import { NextResponse } from "next/server";
import { z } from "zod";

import { sendLineSystemOutboundByCapability } from "@/lib/admin/line/provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Content-Type-Options": "nosniff",
};

const bodySchema = z.object({
  outboundId: z.string().uuid(),
  dispatchToken: z.string().regex(/^[0-9a-f]{64}$/),
}).strict();

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "unsupported-media-type" }, { status: 415, headers });
  }
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > 2_048) {
    return NextResponse.json({ error: "payload-too-large" }, { status: 413, headers });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400, headers });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid-request" }, { status: 400, headers });
  }

  try {
    const result = await sendLineSystemOutboundByCapability(
      parsed.data.outboundId,
      parsed.data.dispatchToken,
    );
    if (result.ok) {
      return NextResponse.json({ status: "sent" }, { status: 200, headers });
    }
    if (result.status === "not_configured") {
      return NextResponse.json({ status: "disabled" }, { status: 409, headers });
    }
    if (result.status === "not_claimable") {
      return NextResponse.json({ status: "ignored" }, { status: 202, headers });
    }
    if (result.status === "reconciliation_required") {
      return NextResponse.json({ status: "reconciliation-required" }, { status: 202, headers });
    }
    if (result.status === "failed" && result.retryClass === "retryable") {
      return NextResponse.json({ status: "retryable" }, { status: 503, headers });
    }
    return NextResponse.json({ status: "terminal" }, { status: 202, headers });
  } catch {
    return NextResponse.json({ status: "retryable" }, { status: 503, headers });
  }
}

export function GET() {
  return new NextResponse(null, { status: 404, headers });
}
