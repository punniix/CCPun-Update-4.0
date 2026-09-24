import { NextResponse } from "next/server";
import { z } from "zod";

import { isSameOriginAdminMutation } from "@/lib/admin/auth-config";
import { getAdminIdentity } from "@/lib/admin/identity";
import { importChatOcrMessages } from "@/lib/admin/line/conversation-archive";
import { hasAdminPermission } from "@/lib/admin/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

const bodySchema = z.object({
  requestId: z.string().regex(/^[A-Za-z0-9._:-]{8,160}$/),
  messages: z.array(z.object({
    direction: z.enum(["inbound", "outbound"]),
    text: z.string().trim().min(1).max(5000),
    occurredAt: z.string().datetime({ offset: true }),
  }).strict()).min(1).max(200),
}).strict();

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

  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > 1_000_000) {
    return NextResponse.json({ error: "payload-too-large" }, { status: 413, headers });
  }

  let value: unknown;
  try { value = JSON.parse(raw); }
  catch { return NextResponse.json({ error: "invalid-json" }, { status: 400, headers }); }

  const parsed = bodySchema.safeParse(value);
  if (!parsed.success) return NextResponse.json({ error: "invalid-ocr-review" }, { status: 400, headers });

  try {
    const result = await importChatOcrMessages({
      leadId: leadId.data,
      requestId: parsed.data.requestId,
      messages: parsed.data.messages,
    });
    return NextResponse.json(result, { headers });
  } catch (error) {
    const code = error instanceof Error ? error.message : "CHAT_OCR_IMPORT_FAILED";
    return NextResponse.json({ error: code.toLowerCase() }, { status: 503, headers });
  }
}
