import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOriginAdminMutation } from "@/lib/admin/auth-config";
import { getAdminIdentity } from "@/lib/admin/identity";
import { updateRetentionPolicy } from "@/lib/admin/line/business-intelligence";
import { hasAdminPermission } from "@/lib/admin/rbac";

export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

const reviewDays = z.number().int().min(1).max(36500).nullable();
const bodySchema = z.object({
  conversationReviewAfterDays: reviewDays,
  documentReviewAfterDays: reviewDays,
  auditReviewAfterDays: reviewDays,
}).strict();

export async function POST(request: Request) {
  const identity = await getAdminIdentity();
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  if (identity.role !== "owner" || !hasAdminPermission(identity.role, "settings:read")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
  }
  if (!isSameOriginAdminMutation(request.url, request.headers.get("origin"))) {
    return NextResponse.json({ error: "invalid-origin" }, { status: 403, headers });
  }

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "invalid-request" }, { status: 400, headers });

  try {
    return NextResponse.json(await updateRetentionPolicy({
      ...body.data,
      actor: identity.actor,
    }), { headers });
  } catch {
    return NextResponse.json({ error: "retention-policy-unavailable" }, { status: 503, headers });
  }
}
