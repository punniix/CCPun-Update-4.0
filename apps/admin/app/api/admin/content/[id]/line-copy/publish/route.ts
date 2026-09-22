import { NextResponse } from "next/server";
import { z } from "zod";

import { isSameOriginAdminMutation } from "@/lib/admin/auth-config";
import { getAdminIdentity } from "@/lib/admin/identity";
import { publishDraftLineCopyOnly } from "@/lib/admin/line/description-optimization";
import { hasAdminPermission } from "@/lib/admin/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Content-Type-Options": "nosniff",
};

const bodySchema = z.object({
  draftRevision: z.string().min(1).max(200),
  publishedRevision: z.string().min(1).max(200),
}).strict();

async function requireOwner() {
  const identity = await getAdminIdentity();
  if (!identity || identity.actorType !== "human" || identity.role !== "owner" || !hasAdminPermission(identity.role, "draft:apply")) return null;
  return identity;
}

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "LINE_COPY_DRAFT_REQUIRED") return NextResponse.json({ error: "line-copy-draft-required" }, { status: 409, headers });
  if (message === "LINE_COPY_PUBLISHED_REQUIRED") return NextResponse.json({ error: "line-copy-published-required" }, { status: 409, headers });
  if (message === "LINE_COPY_CONFLICT") return NextResponse.json({ error: "line-copy-conflict" }, { status: 409, headers });
  if (message === "LINE_COPY_INVALID_REQUEST") return NextResponse.json({ error: "invalid-input" }, { status: 400, headers });
  if (error instanceof z.ZodError) return NextResponse.json({ error: "line-copy-invalid-result" }, { status: 409, headers });
  return NextResponse.json({ error: "line-copy-unavailable" }, { status: 503, headers });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await requireOwner();
  if (!identity) return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
  if (!isSameOriginAdminMutation(request.url, request.headers.get("origin"))) {
    return NextResponse.json({ error: "invalid-origin" }, { status: 403, headers });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid-input" }, { status: 400, headers });

  try {
    const result = await publishDraftLineCopyOnly({
      id: (await params).id,
      draftRevision: parsed.data.draftRevision,
      publishedRevision: parsed.data.publishedRevision,
    });
    return NextResponse.json(result, { headers });
  } catch (error) {
    return failure(error);
  }
}
