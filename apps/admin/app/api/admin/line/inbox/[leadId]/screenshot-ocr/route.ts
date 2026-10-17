import { NextResponse } from "next/server";
import { z } from "zod";

import { isSameOriginAdminMutation } from "@/lib/admin/auth-config";
import { getAdminIdentity } from "@/lib/admin/identity";
import { hasAdminPermission } from "@/lib/admin/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Content-Type-Options": "nosniff",
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> },
) {
  const identity = await getAdminIdentity();
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  if (identity.role !== "owner" || !hasAdminPermission(identity.role, "advisor:case:update")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
  }
  if (!isSameOriginAdminMutation(request.url, request.headers.get("origin"))) {
    return NextResponse.json({ error: "invalid-origin" }, { status: 403, headers });
  }

  const leadId = z.string().uuid().safeParse((await params).leadId);
  if (!leadId.success) return NextResponse.json({ error: "invalid-lead" }, { status: 400, headers });

  if (process.env.CCPUN_CHAT_OCR_ENABLED?.trim() !== "true") {
    return NextResponse.json({ error: "chat-ocr-disabled" }, { status: 503, headers });
  }

  // Security hold: the previous n8n bridge could transmit raw customer screenshots
  // and identifiers to a remotely configured endpoint. Never parse or forward
  // private content until a pinned, authenticated local/private gateway has
  // independent transport, provenance, replay and retention acceptance.
  return NextResponse.json({ error: "chat-ocr-private-gateway-required" }, { status: 503, headers });
}
