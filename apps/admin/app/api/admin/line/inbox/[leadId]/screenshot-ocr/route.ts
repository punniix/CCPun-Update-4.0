import { randomUUID } from "node:crypto";
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

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const allowedMime = new Set(["image/png", "image/jpeg", "image/webp"]);

const proposalSchema = z.object({
  requestId: z.string().min(8).max(160),
  leadId: z.string().uuid().nullable().optional(),
  capturedAt: z.string().nullable().optional(),
  imageDigestSha256: z.string().regex(/^[0-9a-f]{64}$/).nullable().optional(),
  ocrModel: z.string().max(120).optional(),
  status: z.enum(["proposal", "error"]),
  stage: z.string().max(80),
  reviewRequired: z.literal(true),
  messages: z.array(z.object({
    text: z.string().min(1).max(5000),
    side: z.enum(["left", "right", "center", "unknown"]),
    direction: z.enum(["inbound", "outbound", "unknown"]),
    confidence: z.coerce.number().min(0).max(1),
  }).passthrough()).max(200),
  lineCount: z.coerce.number().int().nonnegative().optional(),
  meanConfidence: z.coerce.number().min(0).max(1).optional(),
  lowConfidenceLineCount: z.coerce.number().int().nonnegative().optional(),
  errorCategory: z.string().nullable().optional(),
}).passthrough();

function webhookUrl(variables: Record<string, string | undefined>) {
  const raw = variables.CCPUN_N8N_CHAT_OCR_WEBHOOK_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

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

  const url = webhookUrl(process.env);
  const token = process.env.CCPUN_N8N_CHAT_OCR_TOKEN?.trim();
  if (!url || !token || token.length < 43) {
    return NextResponse.json({ error: "chat-ocr-not-configured" }, { status: 503, headers });
  }

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "invalid-form" }, { status: 400, headers });
  const file = form.get("file");
  const customerSide = form.get("customerSide");
  const capturedAt = form.get("capturedAt");

  if (
    !(file instanceof File)
    || file.size <= 0
    || file.size > MAX_IMAGE_BYTES
    || !allowedMime.has(file.type.toLowerCase())
    || (customerSide !== "left" && customerSide !== "right")
    || typeof capturedAt !== "string"
    || !z.string().datetime({ offset: true }).safeParse(capturedAt).success
  ) {
    return NextResponse.json({ error: "invalid-chat-screenshot" }, { status: 400, headers });
  }

  const requestId = randomUUID();
  const outbound = new FormData();
  outbound.set("data", file, file.name || "chat-screenshot");
  outbound.set("requestId", requestId);
  outbound.set("leadId", leadId.data);
  outbound.set("customerSide", customerSide);
  outbound.set("capturedAt", capturedAt);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: outbound,
      redirect: "error",
      signal: AbortSignal.timeout(120_000),
      cache: "no-store",
    });
    if (!response.ok) {
      return NextResponse.json(
        { error: "chat-ocr-workflow-failed", retryable: response.status >= 500 },
        { status: response.status >= 500 ? 503 : 422, headers },
      );
    }
    const parsed = proposalSchema.safeParse(await response.json());
    if (!parsed.success || parsed.data.requestId !== requestId || parsed.data.leadId !== leadId.data) {
      return NextResponse.json({ error: "chat-ocr-invalid-response" }, { status: 503, headers });
    }
    return NextResponse.json(parsed.data, { status: 200, headers });
  } catch {
    return NextResponse.json(
      { error: "chat-ocr-unavailable", retryable: true },
      { status: 503, headers: { ...headers, "Retry-After": "30" } },
    );
  }
}
